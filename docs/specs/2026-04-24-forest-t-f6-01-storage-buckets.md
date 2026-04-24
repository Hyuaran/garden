# T-F6-01: Storage Bucket 作成（forest-docs / forest-downloads）実装指示書

- 対象: Garden-Forest F6 Download Section のインフラ準備
- 見積: **0.25d**（約 2 時間、Dashboard 操作含む）
- 担当セッション: a-forest（東海林さんの Dashboard 操作協力必要）
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F6-01）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.6, `docs/specs/2026-04-24-forest-t-f6-03-download-zip-edge.md`
- **判3 = B 案採用**（PDF を Supabase Storage にミラー）

---

## 1. スコープ

### 作る
- Supabase Storage bucket 2 つ作成
  1. **`forest-docs`** — 決算書 PDF 本体（永続、private、admin+ write / forest_users read）
  2. **`forest-downloads`** — ZIP 一時格納（短寿命、private、生成者本人のみ read）
- 両バケットの RLS ポリシー（`storage.objects` に対する policy）
- bucket 作成 migration + 検証クエリ
- 東海林さん向け「Dashboard 操作手順書」（必要な GUI 設定）

### 作らない
- PDF 本体の Storage へのアップロード（T-F6-02 で実施）
- ZIP 生成ロジック（T-F6-03 で実装済、Batch 2）
- フロント UI（T-F6-04 で別 spec）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| Supabase プロジェクト | `garden-dev` / `garden-prod` の 2 環境あり |
| 既存 RLS ヘルパー関数 | `forest_is_user()` / `forest_is_admin()`（Batch 1 P08 で言及）|
| `storage.objects` テーブル | Supabase デフォルトで存在 |
| 既存 bucket | `forest-tax/`（T-F5-01 で作成、本 spec と同時期）|
| **Supabase Dashboard アクセス**: 東海林さん（super_admin）が必要な操作を実行 |

**権限注意**: Storage 操作は Service Role Key が必要なケース多し。SQL 経由で足りないものは Dashboard GUI で補完。

---

## 3. ファイル構成

### 新規
- `supabase/migrations/20260424_01_forest_storage_buckets.sql` — bucket + RLS 作成 SQL
- `docs/specs/2026-04-24-forest-t-f6-01-storage-buckets.md` — **本 spec**（東海林さん向け手順書を含む）

### 変更なし
- 本 spec では TSX コード・既存 SQL は変更しない

---

## 4. 型定義

本 spec は DB/Storage のインフラのみで TypeScript 型定義は不要。後続の T-F6-02 / T-F6-03 / T-F6-04 で必要な型は既に Batch 2 の T-F6-03 で定義済：
- `DownloadZipRequest` / `DownloadZipResponse` / `ResolvedTarget`（T-F6-03 §4 参照）

---

## 5. 実装ステップ

### Step 1: SQL migration 作成
```sql
-- supabase/migrations/20260424_01_forest_storage_buckets.sql
-- 注: 先に Supabase Dashboard か storage API で bucket を物理作成してから実行する。
-- storage.buckets への INSERT は権限次第で失敗することがあるため、Dashboard 併用を推奨。

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Bucket 作成（Dashboard で先に作成推奨。冪等性のため ON CONFLICT 指定）
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('forest-docs',       'forest-docs',      false, 52428800,  ARRAY['application/pdf']),
  ('forest-downloads',  'forest-downloads', false, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET
  public              = EXCLUDED.public,
  file_size_limit     = EXCLUDED.file_size_limit,
  allowed_mime_types  = EXCLUDED.allowed_mime_types;

-- file_size_limit:
--   forest-docs      50MB（決算書 PDF 1 ファイル想定、A4 × 50 頁程度）
--   forest-downloads 200MB（6 社 × 3 期 ≒ 18 PDF の ZIP が想定最大）

-- allowed_mime_types:
--   forest-docs      PDF のみ
--   forest-downloads 無制限（ZIP / octet-stream 両対応のため）

-- ---------------------------------------------------------------------
-- 2. RLS: forest-docs（PDF 本体）
-- ---------------------------------------------------------------------
-- SELECT: forest_users 登録済なら全員閲覧可
CREATE POLICY fd_read_forest_user
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-docs' AND forest_is_user());

-- INSERT: admin / super_admin のみ（T-F6-02 ミラーリングバッチが service_role_key 経由で実行）
CREATE POLICY fd_insert_admin
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forest-docs' AND forest_is_admin());

-- UPDATE: admin / super_admin のみ（差し替え用）
CREATE POLICY fd_update_admin
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'forest-docs' AND forest_is_admin())
  WITH CHECK (bucket_id = 'forest-docs' AND forest_is_admin());

-- DELETE: super_admin のみ（万一の整理用）
CREATE POLICY fd_delete_super_admin
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'forest-docs'
    AND (SELECT role FROM forest_users WHERE user_id = auth.uid()) = 'super_admin'
  );

-- ---------------------------------------------------------------------
-- 3. RLS: forest-downloads（ZIP 一時格納）
-- ---------------------------------------------------------------------
-- SELECT: 生成者本人のみ（owner カラムが auth.uid() と一致）
CREATE POLICY fdl_read_owner
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-downloads' AND owner = auth.uid());

-- INSERT: Route Handler が service_role_key 経由で行う前提のため、明示的 policy は不要
-- ただし RLS を完全に bypass しないために forest_is_user() ポリシーを追加
CREATE POLICY fdl_insert_forest_user
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forest-downloads' AND forest_is_user());

-- DELETE: 掃除 Cron（super_admin or service_role）のみ
CREATE POLICY fdl_delete_super_admin
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'forest-downloads'
    AND (SELECT role FROM forest_users WHERE user_id = auth.uid()) = 'super_admin'
  );

COMMIT;
```

### Step 2: Supabase Dashboard 手動操作（東海林さん実施）

以下は SQL だけでは実行しきれない / SQL で失敗するリスクがあるため、**Dashboard GUI での操作を推奨**：

#### 2.1 Bucket 物理作成（Dashboard）
1. Supabase Dashboard → Storage → "New bucket"
2. `forest-docs` 作成
   - Public bucket: **OFF**
   - File size limit: 50 MB
   - Allowed MIME types: `application/pdf`
3. `forest-downloads` 作成
   - Public bucket: **OFF**
   - File size limit: 200 MB
   - Allowed MIME types: (空欄 = 無制限)

#### 2.2 RLS 有効化確認
- Dashboard → Authentication → Policies → `storage.objects`
- デフォルトで RLS 有効のはず。無効なら "Enable RLS" をクリック

#### 2.3 Policy 適用（SQL Editor で Step 1 を実行）
- Dashboard → SQL Editor → New query
- Step 1 の SQL を貼り付け
- 環境別（dev / prod）それぞれで実行

### Step 3: 検証クエリ
```sql
-- Bucket 作成確認
SELECT id, name, public, file_size_limit, allowed_mime_types
  FROM storage.buckets
  WHERE id IN ('forest-docs', 'forest-downloads');

-- Policy 適用確認
SELECT policyname, cmd, qual
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname LIKE 'fd%';
-- 期待: fd_read_forest_user / fd_insert_admin / fd_update_admin / fd_delete_super_admin
--       fdl_read_owner / fdl_insert_forest_user / fdl_delete_super_admin
```

### Step 4: 動作確認（手動）
1. **forest_user 権限で SELECT**: Dashboard → Storage → forest-docs → ファイルがあれば一覧表示される
2. **非 forest_user で SELECT**: 別アカウントでログイン → 403 確認
3. **admin で INSERT**: ダミー PDF を forest-docs にアップロード → 成功
4. **staff で INSERT**: 別アカウントでアップロード試行 → 403 確認

---

## 6. データソース

本 spec は Storage インフラ作成のため「データソース」自体を用意する位置づけ：

| 種類 | 内容 |
|---|---|
| Storage bucket | `forest-docs`（永続、PDF 本体）|
| Storage bucket | `forest-downloads`（一時、ZIP）|
| 既存テーブル | `forest_users`（RLS 判定用）|

---

## 7. UI 仕様

なし（インフラ作成のみ）。UI は T-F6-04（Download Section）で別途。

---

## 8. エラーハンドリング

### 8.1 SQL 実行時
| # | エラー | 対応 |
|---|---|---|
| E1 | `storage.buckets` への INSERT 権限不足 | Dashboard GUI で bucket を先に作成してから SQL 実行 |
| E2 | Policy 重複作成（`already exists`）| `DROP POLICY IF EXISTS ...` を先行実行するか `CREATE POLICY IF NOT EXISTS`（Postgres 16+）|
| E3 | `forest_is_user()` が未定義 | 前提チェック漏れ。Batch 1 の Forest RLS 関数群を先に投入 |

### 8.2 運用時
| # | シナリオ | 対応 |
|---|---|---|
| E4 | bucket 容量逼迫 | Supabase ダッシュボードでアラート設定、forest-downloads の Cron 掃除（別 spec） |
| E5 | 誤削除 | Storage には soft-delete 機能なし。バックアップは Supabase の DB バックアップとは別管理 → 定期ダウンロード検討 |

---

## 9. 権限・RLS

### forest-docs
| 操作 | 許可ロール | 根拠 |
|---|---|---|
| SELECT | `forest_is_user()` | 全 forest ユーザーが決算書閲覧可 |
| INSERT | `forest_is_admin()` | T-F6-02 ミラーリングバッチで admin+ が実行 |
| UPDATE | `forest_is_admin()` | 差し替え（訂正版 PDF 等）|
| DELETE | `super_admin` のみ | 事故防止 |

### forest-downloads
| 操作 | 許可ロール | 根拠 |
|---|---|---|
| SELECT | `owner = auth.uid()` | 生成者本人のみ、漏洩リスク最小化 |
| INSERT | `forest_is_user()` | 実体は Route Handler から service_role_key 経由 |
| DELETE | `super_admin` のみ | 掃除 Cron は service_role で別管理 |

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | 両 bucket 作成・存在確認 |
| 3 | **権限** | forest_user / admin / 非ユーザー / super_admin の 4 ロールで SELECT/INSERT/UPDATE/DELETE の期待値検証 |
| 5 | パフォーマンス | bucket 作成 1 秒以内（実質は Dashboard 操作時間）|
| 6 | Console | Supabase Dashboard Logs にエラーなし |

**特に権限テストは必須**。悪意ある INSERT / DELETE がブロックされることを実機で確認。

---

## 11. 関連参照

- **P07 §4.6**: F6 Download Section 差分、判3 B 案、判4 B 案
- **T-F6-03** [forest-t-f6-03-download-zip-edge.md](2026-04-24-forest-t-f6-03-download-zip-edge.md) Step 2: 本 spec の前提として記載されている migration
- **T-F6-02** [forest-t-f6-02-drive-to-storage-migration.md](2026-04-24-forest-t-f6-02-drive-to-storage-migration.md): 本 spec 完了後に Drive → Storage ミラーリングを実施
- **T-F5-01** [forest-t-f5-01-tax-files-infrastructure.md](2026-04-24-forest-t-f5-01-tax-files-infrastructure.md): 同時期に bucket `forest-tax/` を作成、スタイル踏襲
- **Supabase Storage API**: https://supabase.com/docs/reference/javascript/storage
- **known-pitfalls.md §6.1** Service Role Key 境界管理

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | `forest-docs` の `file_size_limit` 50MB は十分か | **50MB で開始**、運用で 20MB 超えるファイルが多ければ 100MB に引き上げ |
| 判2 | `forest-downloads` の Cron 掃除実装時期 | **Phase A 内では省略**、5 分 signedURL 失効で実害なし |
| 判3 | UPDATE 時の版管理（前版保持）| 現状「上書き」で運用、将来 `forest_docs_versions` テーブル検討 |
| 判4 | `storage.buckets` 直接 INSERT が失敗する環境 | Dashboard 手動作成で回避（本 spec §2.1 に手順明記）|
| 判5 | バックアップ戦略 | **別 spec**。Supabase 自動バックアップに依存、定期手動 dump は未計画 |

— end of T-F6-01 spec —
