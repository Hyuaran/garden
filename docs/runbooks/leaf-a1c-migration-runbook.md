# Leaf A-1c v3 Migration 実行手順書（東海林さん向け）

- 対象 migration: `scripts/leaf-schema-patch-a1c.sql` / `supabase/migrations/20260425000005_leaf_a1c_attachments.sql`
- 対象環境: garden-dev（先行）→ garden-prod（β版投入時に別途）
- 所要時間: 約 5〜10 分（Dashboard 操作 + 確認クエリ）
- 実施タイミング: spec/plan PR (#58) merge 後、Task D 以降の実装着手前
- 関連 spec: `docs/superpowers/specs/2026-04-23-leaf-a1c-attachment-design.md` §8 (v3)

---

## §1. 事前準備（東海林さんが実施）

### 1.1 依存確認

以下が **すべて完了** していることを確認:

- [x] Root A-3-g（A-3-g schema patch）develop マージ済 ✅（`is_user_active` / `garden_role_of` / `outsource` / `contract_end_on`）
- [x] Root A-3-h（A-3-h schema patch）develop マージ済 ✅（影響なし）
- [ ] **本 PR（Task D.1 migration SQL）** が develop merge 済（または cherry-pick で garden-dev に適用準備）

### 1.2 自分の `user_id` を控える

Supabase Dashboard > Authentication > Users で、東海林さん（super_admin 想定）の `id`（UUID 形式、例: `a1b2c3d4-...`）をコピーしてメモ帳に保存。後の §3 で使用。

### 1.3 仮 PW の控え

migration 内で初期投入される画像 DL 専用 PW の仮値は **`change-me-immediately`**（平文）。これは migration 後に **即変更が必要**（§4 で変更）。

---

## §2. Migration SQL 実行

Supabase Dashboard > garden-dev > **SQL Editor** で実行する。順番に実行することを推奨（一度に全量貼付でも OK）。

### 2.1 全量貼付方式（推奨、所要 1 分）

1. Dashboard を開く: https://supabase.com/dashboard/project/<garden-dev のプロジェクト ID>
2. **SQL Editor** を選択
3. **New query** ボタン
4. `scripts/leaf-schema-patch-a1c.sql` の内容を全コピーして貼付
5. **Run** クリック
6. エラーなく「Success. No rows returned」が表示されたら OK

### 2.2 ブロック単位方式（慎重派、所要 5 分）

問題が起きたときに切り戻しやすいので、慎重に進めたい場合はこちら。

1. §0 拡張機能 → §1 既存テーブル拡張 → §2 事業マスタ → §3 root_settings → §4 関数 → §5 bucket → §6 RLS 有効化 → §7-12 ポリシー → §13 履歴テーブル + trigger → §14 RPC → §15 初期データ の順で 1 ブロックずつ実行
2. 各ブロックで Success を確認してから次へ

---

## §3. 東海林さんを super_admin + 関電所属で登録

migration 直後、東海林さんが Leaf にアクセスできるように `leaf_user_businesses` に登録します。

SQL Editor で以下を実行（`<your_user_id>` は §1.2 で控えた UUID に置換）:

```sql
-- 東海林さんを関電事業に super_admin として登録
INSERT INTO leaf_user_businesses (user_id, business_id, role_in_biz, assigned_by)
VALUES (
  '<your_user_id>',  -- 実 UUID に置換
  'kanden',
  'super_admin',
  '<your_user_id>'   -- 同 UUID
)
ON CONFLICT (user_id, business_id) DO NOTHING;

-- 確認
SELECT * FROM leaf_user_businesses WHERE user_id = '<your_user_id>';
```

期待結果: 1 行返る（user_id / business_id='kanden' / role_in_biz='super_admin'）。

---

## §4. 画像 DL 専用パスワード本番値設定（最重要）

仮 PW `change-me-immediately` は危険なので **即変更**。設定方法は 2 通り:

### 4.1 Root マイページ UI 経由（推奨、Task A.7 実装後に利用可能）

Task A.7（Root マイページ DL PW 設定 UI）が develop merge 後に利用可能。
それまでは §4.2 の Dashboard 経由で実行。

### 4.2 Dashboard SQL 経由（Task A.7 完成前の暫定）

新パスワード（例: `MyKandenPW2026Q2`、8 文字以上 + 英数字混在推奨）を決めてから、SQL Editor で以下を実行:

```sql
-- 新パスワードを bcrypt (rounds=12) で hash 化して登録
SELECT set_image_download_password(
  crypt('MyKandenPW2026Q2', gen_salt('bf', 12))
);

-- 検証: 新 PW で TRUE が返ること
SELECT verify_image_download_password('MyKandenPW2026Q2');  -- → t
SELECT verify_image_download_password('change-me-immediately');  -- → f
```

**設定後、社内の関電業務委託メンバーに Chatwork 等で新 PW を通知**。

---

## §5. 適用結果確認チェックリスト

`scripts/leaf-schema-patch-a1c.sql` 末尾 §16 のクエリを順次実行してチェック。すべて期待通りなら migration 成功。

```sql
-- 1. 拡張機能
SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
-- 期待: pgcrypto が 1 行返る

-- 2. 列追加
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'leaf_kanden_attachments'
  AND column_name IN ('deleted_at', 'deleted_by');
-- 期待: 2 行（deleted_at: timestamp with time zone / deleted_by: uuid）

-- 3. テーブル作成
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('leaf_businesses', 'leaf_user_businesses', 'leaf_kanden_attachments_history', 'root_settings');
-- 期待: 4 行（4 テーブル）

-- 4. 関数作成
SELECT proname FROM pg_proc
WHERE proname IN ('leaf_user_in_business', 'verify_image_download_password',
                  'set_image_download_password', 'leaf_kanden_attachments_history_trigger');
-- 期待: 4 行

-- 5. bucket 作成
SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets
WHERE id LIKE 'leaf-kanden-photos-%' ORDER BY id;
-- 期待: 3 行
--   leaf-kanden-photos-monthly | 52428800 | {application/pdf}
--   leaf-kanden-photos-recent  | 5242880  | {image/jpeg, image/png, image/heic}
--   leaf-kanden-photos-yearly  | 52428800 | {application/pdf}

-- 6. ポリシー（合計 22 個想定）
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('leaf_kanden_attachments', 'leaf_businesses',
                    'leaf_user_businesses', 'leaf_kanden_attachments_history',
                    'root_settings', 'objects')
  AND (policyname LIKE 'leaf_%' OR policyname LIKE 'root_settings_%')
ORDER BY tablename, policyname;
-- 期待:
--   leaf_kanden_attachments: 4 ポリシー (select/insert/update/delete)
--   leaf_kanden_attachments_history: 2 ポリシー (select/no_write)
--   leaf_businesses: 2 ポリシー (select/write)
--   leaf_user_businesses: 2 ポリシー (select/write)
--   root_settings: 2 ポリシー (select_leaf/write_leaf)
--   storage.objects: 10 ポリシー (recent 4 + archive 4 + 既存他)
-- 合計 22 ポリシー（既存 storage.objects ポリシーは除く）

-- 7. trigger 確認
SELECT trigger_name, event_manipulation FROM information_schema.triggers
WHERE trigger_name = 'trg_leaf_kanden_attachments_history';
-- 期待: 2 行 (UPDATE / DELETE)

-- 8. 初期データ
SELECT * FROM leaf_businesses;
-- 期待: 1 行 (kanden / 関電業務委託)

SELECT key, value->>'hash' AS hash_preview, description FROM root_settings WHERE key LIKE 'leaf.%';
-- 期待: 1 行 (leaf.image_download_password_hash, hash_preview は $2b$12$... で始まる文字列)

-- 9. ログイン中の動作確認（東海林さんアカウントで実行）
SELECT public.is_user_active();              -- → t (アクティブ)
SELECT public.garden_role_of(auth.uid());    -- → super_admin
SELECT public.leaf_user_in_business('kanden');  -- → t (関電所属、§3 で登録済)

-- 10. 仮 PW 検証（変更前の確認用）
SELECT public.verify_image_download_password('change-me-immediately');  -- → t
-- §4 で本番 PW に変更後は → f になる
```

---

## §6. ロールバック手順（万が一の備え）

migration 全部を巻き戻す場合（推奨せず、影響範囲大）。

```sql
-- 1. trigger 削除
DROP TRIGGER IF EXISTS trg_leaf_kanden_attachments_history ON leaf_kanden_attachments;
DROP FUNCTION IF EXISTS leaf_kanden_attachments_history_trigger();

-- 2. RPC 削除
DROP FUNCTION IF EXISTS verify_image_download_password(text);
DROP FUNCTION IF EXISTS set_image_download_password(text);

-- 3. 事業所属関数削除
DROP FUNCTION IF EXISTS leaf_user_in_business(text);

-- 4. ポリシー削除（leaf_*, root_settings_*）
-- ※ 多数のため pg_policies 確認後に手動削除

-- 5. テーブル削除（参照整合性順）
DROP TABLE IF EXISTS leaf_kanden_attachments_history;
DROP TABLE IF EXISTS leaf_user_businesses;
DROP TABLE IF EXISTS leaf_businesses;

-- 6. root_settings の Leaf キー削除（テーブル自体は Tree 等が使うため残す）
DELETE FROM root_settings WHERE key LIKE 'leaf.%';

-- 7. 列削除
ALTER TABLE leaf_kanden_attachments
  DROP COLUMN IF EXISTS deleted_at,
  DROP COLUMN IF EXISTS deleted_by;

-- 8. インデックス削除
DROP INDEX IF EXISTS idx_leaf_kanden_attachments_case_id_active;
DROP INDEX IF EXISTS idx_leaf_kanden_attachments_case_id_deleted;
```

**注意**: ロールバック後は Leaf の機能が一切使えない状態になる。本番投入後は基本的にロールバック不可、forward-fix で対応。

---

## §7. トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| `function is_user_active() does not exist` | Root A-3-g 未マージ | Root A-3-g 適用を先行 |
| `function garden_role_of(uuid) does not exist` | Root A-3-g 未マージ | 同上 |
| `function crypt(text, text) does not exist` | pgcrypto 未有効化 | `CREATE EXTENSION pgcrypto;` 単独実行 |
| `relation root_employees does not exist` | Root schema 全体が未投入 | Root を先行（通常はあり得ない） |
| `relation root_settings already exists` | Tree spec 等で先行作成済 | OK（IF NOT EXISTS で無害）|
| `bucket leaf-kanden-photos-recent already exists` | 過去に部分投入 | OK（ON CONFLICT DO UPDATE で size/MIME のみ更新）|
| `policy leaf_attachments_select already exists` | 過去に部分投入 | OK（DROP POLICY IF EXISTS で再作成）|
| Storage で 413 Payload Too Large | recent bucket size 5MB 超 | 期待動作（client 側で圧縮されているはず）|

---

## §8. Migration 完了後の次ステップ

1. spec/plan PR (#58) develop merge 確認
2. Task 0.2 + 0.3 PR 発行 + a-bloom レビュー
3. Task D.2（src/lib/supabase/client.ts 新設）から実装着手
4. Phase D の各 task を順次 PR で消化
5. Task A.7（Root DL PW 設定 UI）develop merge 後、§4 の本番 PW 設定を **UI 経由** に移行
