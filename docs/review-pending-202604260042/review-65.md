# a-review レビュー — Task D.1 migration SQL + 実行手順書

## 概要

Garden-Leaf Phase A-1c v3 添付ファイル機能の Supabase migration を起票する PR。`scripts/leaf-schema-patch-a1c.sql`（Dashboard 用）と `supabase/migrations/20260425000005_leaf_a1c_attachments.sql`（CLI 用）の **2 ファイル同一内容** + 東海林さん向け runbook 1 本（242 行）。pgcrypto 拡張 / 4 テーブル新設 / 22 RLS ポリシー / 2 RPC / history trigger / 3 storage bucket を一括投入する重量級 DDL。

## 良い点

1. **idempotent 設計が徹底**：`CREATE EXTENSION IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` / `INSERT ... ON CONFLICT DO NOTHING|UPDATE` / `DROP POLICY IF EXISTS ... CREATE POLICY` の組み合わせで、部分再実行・複数環境適用がしやすい。
2. **runbook がストレートで実用的**：§1 事前準備 → §2 SQL 実行 → §3 super_admin 登録 → §4 PW 変更 → §5 検証 10 項目 → §6 ロールバック → §7 トラブルシュート → §8 次ステップ という流れで、東海林さんが手元で迷わない構成になっている。検証 SQL も §16 とリンクしており、実行後の確認漏れが起きにくい。
3. **論理削除（deleted_at + deleted_by）と物理削除（DELETE policy = admin+）の二層設計**が known-pitfalls #8（deleted_at vs is_active 別軸）と整合している。部分インデックス `WHERE deleted_at IS NULL` / `IS NOT NULL` も active / 削除済の両方をカバーしていて good。
4. **history trigger の `to_jsonb(OLD)::text` で DELETE 時に行全体を保存**するパターンは UPDATE 時の列単位 diff と組み合わせて監査要件を満たす。`SECURITY DEFINER` で RLS をバイパスしつつ `leaf_history_no_write` ポリシーで通常書込を完全遮断している点も良い。
5. **bucket 単位の MIME / size 制約が明示**（recent: image/jpeg|png|heic + 5MB / monthly,yearly: pdf + 50MB）。アーカイブ bucket は INSERT/UPDATE/DELETE = FALSE で完全 read-only に固定、Phase B の移行バッチでは service_role 経由で書込む前提が読み取れる。

## 指摘事項

### REQUEST CHANGES 級

#### 🔴 #1 SECURITY DEFINER 関数の `search_path` 未設定（重要）

`leaf_user_in_business` / `verify_image_download_password` / `set_image_download_password` / `leaf_kanden_attachments_history_trigger` の **4 関数すべて** が `SECURITY DEFINER` だが `SET search_path` 句がない。これは PostgreSQL では既知の権限昇格脆弱性パターン（CVE-2018-1058 系）で、Supabase でも公式に推奨される対策が以下：

```sql
CREATE OR REPLACE FUNCTION leaf_user_in_business(biz_id text)
RETURNS boolean
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog  -- ★ 追加必須
AS $$
  SELECT EXISTS (...) AND is_user_active();
$$;
```

該当箇所:
- `scripts/leaf-schema-patch-a1c.sql:91-103` (leaf_user_in_business)
- `scripts/leaf-schema-patch-a1c.sql:268-281` (history_trigger)
- `scripts/leaf-schema-patch-a1c.sql:330-343` (verify_image_download_password)
- `scripts/leaf-schema-patch-a1c.sql:348-368` (set_image_download_password)
- 同 supabase/migrations/20260425000005_leaf_a1c_attachments.sql の対応箇所

未設定のままだと、悪意あるユーザーが自身の `search_path` を変更してから RLS 経由で関数を呼び出すと、`is_user_active()` / `crypt()` / `auth.uid()` が想定外のスキーマに解決される可能性がある（Supabase の Linter `security_definer_view` / `function_search_path_mutable` 警告で検出される項目）。

#### 🔴 #2 `set_image_download_password` がクライアント側で hash 化された値を受け取る設計

```sql
CREATE OR REPLACE FUNCTION set_image_download_password(new_hash text) ...
  -- INSERT INTO root_settings ... value = jsonb_build_object('hash', new_hash) ...
```

API として hash 文字列を受け取って格納するだけなので、client が誤って **平文を渡すと平文がそのまま root_settings に保存される**。検証ロジック（`verify_image_download_password` の `crypt(input, stored_hash)`）は、stored_hash が bcrypt 形式 (`$2a$...` / `$2b$...`) でなければ `crypt()` がエラーを投げる or 任意の入力に対し誤判定する。

修正案: 引数を平文に変えてサーバー側で hash 化する。

```sql
CREATE OR REPLACE FUNCTION set_image_download_password(new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF garden_role_of(auth.uid()) != 'super_admin' THEN
    RAISE EXCEPTION 'Forbidden: super_admin only';
  END IF;
  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;
  INSERT INTO root_settings (key, value, updated_at, updated_by)
  VALUES (
    'leaf.image_download_password_hash',
    jsonb_build_object('hash', crypt(new_password, gen_salt('bf', 12))),
    now(), auth.uid()
  )
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
END;
$$;
```

これなら client は平文を送るだけで済み、bcryptjs 依存も不要（package.json から `bcryptjs` を外せる可能性あり、要検討）。runbook §4.2 の `crypt('MyKandenPW2026Q2', gen_salt('bf', 12))` も簡潔になる。

### 推奨改善

#### 🟡 #3 `verify_image_download_password` RPC が無認証 / 無制限で呼べる

このRPCは認証ユーザーなら誰でも呼べる。`stored_hash IS NULL → FALSE` で早期 return しているので bcrypt 比較を毎回走らせるブルートフォース耐性は bcrypt cost (12) に依存する。リスクは低めだが以下のいずれかの保険を推奨：
- RPC 内で `garden_role_of(auth.uid()) IS NOT NULL`（ロールが解決できる = アクティブ従業員）チェック
- もしくは `leaf_user_in_business('kanden') OR garden_role_of(...) IN ('admin','super_admin')` ガード
- Route Handler 側でレート制限（IP 単位 / user 単位）

#### 🟡 #4 `leaf_recent_update` ポリシーが `USING (bucket_id = '...' AND FALSE)` という冗長表現

```sql
CREATE POLICY leaf_recent_update ON storage.objects FOR UPDATE
  USING (bucket_id = 'leaf-kanden-photos-recent' AND FALSE);
```

`AND FALSE` で常に偽。これは「recent bucket の UPDATE は禁止」を表現しているはずだが、bucket_id 比較を残す意味がない（FALSE で短絡される）。`leaf_archive_update USING (FALSE)` と比べて一貫性に欠ける。意図的に「このポリシーが特定 bucket だけを対象にする」と明示する DSL 用法なら OK だが、その場合は他の archive ポリシーも同じ形にすべき。実害はないので 🟡。

#### 🟡 #5 history trigger の `to_jsonb(OLD)::text` でサイズ無制限

DELETE 時に行全体を `text` 列に格納するが、`leaf_kanden_attachments` には `storage_url` / `thumbnail_url` などの URL も含む。長期運用で history テーブルが肥大化する可能性。Phase B 以降で TTL 別 partition / archive 設計を検討。今回は 🟡 で言及のみ。

#### 🟡 #6 `bcryptjs` 依存追加が PR 内で混入（task 指示確認）

PR description では `chore(leaf): A-1c v3 npm 5 個追加` を別 commit `3d6e9d5` として分離している記述だが、本 PR の changedFiles には `package.json` / `package-lock.json` の +5 + 546 行が含まれている（D.1 自体は SQL + Markdown のみのはず）。レビュー task の指示「コード PR で混入なら指摘」に該当。npm install は別 PR で分離するか、本 PR の commit 構成を整理した上で merge 順を決めるか、東海林さん判断が必要（D.2-D.5 すべての PR にも同じ npm 差分が入っている件と合わせて、まとめて 1 個の chore PR で develop に先行 merge することを推奨）。

`bcryptjs` 自体は前述 #2 で `set_image_download_password` をサーバー hash 化に変更すれば不要になる可能性。`heic2any` / `msw` / `@testing-library/user-event` / `@types/bcryptjs` は後続 task で必要なので、5 個まとめて chore で先行 merge が妥当。

#### 🟡 #7 runbook §6 ロールバックの「ポリシー削除は手動」がリスキー

```markdown
-- 4. ポリシー削除（leaf_*, root_settings_*）
-- ※ 多数のため pg_policies 確認後に手動削除
```

22 個のポリシーを手動でコピペは事故の元。runbook 内に `DROP POLICY IF EXISTS leaf_attachments_select ON leaf_kanden_attachments;` など全ポリシーの DROP 文を網羅して書き出した方が安全。本 PR で書き切るか、別 issue で TODO 化を推奨。

### 軽微

#### 🟢 #8 ロールバック後 `root_settings` テーブル自体を残す方針は good

Tree spec も同テーブルを使うため、`DROP TABLE` ではなく `DELETE FROM root_settings WHERE key LIKE 'leaf.%'` にしている点はモジュール間調整として正しい。

#### 🟢 #9 `idx_leaf_user_businesses_user_active` の partial index `WHERE removed_at IS NULL` は所属者一覧クエリ用に効果的。

#### 🟢 #10 `leaf_kanden_attachments` の case_id インデックスを active / deleted で 2 本に分けたのは pruning 効率化として正しい設計。

## known-pitfalls.md 横断チェック

| # | 関連有無 | コメント |
|---|---|---|
| #1 timestamptz 空文字 | ✅ 整合 | テーブル定義はすべて `DEFAULT now()`、空文字 insert を強制する箇所なし |
| #2 RLS anon 流用 | 🟡 後続注意 | 本 PR は SQL のみだが、後続の Route Handler 実装で `verify_image_download_password` を呼ぶ際は JWT 転送 / service_role で RLS 経由を厳守 |
| #3 空 payload insert | ✅ N/A | DDL のみ |
| #4 KoT IP 制限 | ✅ N/A | KoT 連携なし |
| #5 Vercel Cron + Fixie | ✅ N/A | Cron 利用なし |
| #6 garden_role CHECK 制約 | ✅ 整合 | `garden_role_of(auth.uid()) IN (...)` パターンを使い、ENUM 前提のクエリではない |
| #7 KoT date 形式 | ✅ N/A | KoT 連携なし |
| #8 deleted_at vs is_active | ✅ 整合 | `deleted_at` を `attachments` に追加、`is_active` は事業マスタ側に独立 |

## spec / plan 整合

PR description で v3 改訂事項 4 点（論理削除全員可化 / 画像 DL 専用 PW / 変更履歴 trigger / マトリクス簡略化）の反映を明示しており、SQL の対応箇所と一致している。spec §8 v3 全量を読み込んだ上での起票と判断できる。

依存関係（Root A-3-g / A-3-h merge 済 / pgcrypto / root_settings 互換作成）も runbook §1 で明示されており、適用順序の事故は起きにくい。

## 判定

**REQUEST CHANGES**

**理由**:
- 🔴 #1 (search_path 未設定) は SECURITY DEFINER 関数の標準対策として必須。Supabase Linter で警告される項目なので、本番投入前に必ず修正。
- 🔴 #2 (hash 引数受取) は client 側 bcryptjs 依存とのトレードオフだが、誤って平文格納される事故シナリオを防ぐためサーバー hash 化を推奨。

🟡 系（#3-#7）は本 PR で対応するか、フォローアップ issue 化するかは東海林さん判断。
🟢 評価が高い設計（idempotent / runbook / deleted_at 二層 / history trigger / bucket 制約）は維持してください。

東海林さん帰宅後、上記 🔴 2 件の修正方針を確認の上、re-review か merge 判断をお願いします。

---
🤖 a-review (PR レビュー専属セッション) by Claude Opus 4.7 (1M context)
