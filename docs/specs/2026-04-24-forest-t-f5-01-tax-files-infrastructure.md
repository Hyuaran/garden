# T-F5-01: Tax Files インフラ（テーブル + Storage bucket + RLS）実装指示書

- 対象: Garden-Forest F5 Tax Files の基盤
- 見積: **0.5d**（約 4 時間、Dashboard 操作含む）
- 担当セッション: a-forest
- 作成: 2026-04-24（a-auto / Phase A 先行 batch3 #T-F5-01）
- 元資料: `docs/specs/2026-04-24-forest-v9-vs-tsx-comparison.md` §4.5
- **判5 = B 案採用**（社内担当者が代理入力）

---

## 1. スコープ

### 作る
- 新規テーブル `forest_tax_files`（税理士連携ファイルのメタデータ）
- Storage bucket `forest-tax`（税理士連携ファイル本体、PDF/xlsx/csv 等）
- テーブル RLS ポリシー（SELECT: forest_user, INSERT/UPDATE/DELETE: admin+）
- Storage bucket RLS ポリシー（同等）
- 検索用インデックス

### 作らない
- TSX UI（T-F5-02 / T-F5-03 で別 spec）
- 税理士からの API 投入（判5 で却下、社内代理入力）
- 自動 OCR / メタデータ抽出（Phase B 以降）

---

## 2. 前提

| 依存 | 内容 |
|---|---|
| Forest 既存 RLS 関数 | `forest_is_user()`, `forest_is_admin()` |
| Forest 既存テーブル | `companies`（法人マスタ、`id` FK）|
| Supabase Dashboard アクセス | bucket 作成は東海林さんが Dashboard で実施 |
| T-F6-01 | 同時期に `forest-docs` / `forest-downloads` を作成、命名パターン参考 |

---

## 3. ファイル構成

### 新規
- `supabase/migrations/20260424_02_forest_tax_files.sql` — テーブル + RLS
- `supabase/migrations/20260424_03_forest_tax_storage.sql` — Storage bucket 作成 + Storage RLS

### 変更
- `scripts/forest-schema.sql`（既存）に追記するか別ファイルで管理 — **別ファイル推奨**（migration 単位の独立性のため）

---

## 4. 型定義

```typescript
// src/app/forest/_lib/types.ts に追加
export type TaxFileStatus = 'zanntei' | 'kakutei';       // 暫定 / 確定

export type TaxFile = {
  id: string;                          // uuid
  company_id: string;                  // 'hyuaran' 等、companies.id を FK
  doc_name: string;                    // 表示用ドキュメント名（例: '2024年度 確定申告書'）
  file_name: string;                   // 元ファイル名（Storage パスと別）
  storage_path: string;                // Supabase Storage 内パス（例: 'hyuaran/2024_kakutei.pdf'）
  status: TaxFileStatus;
  doc_date: string | null;             // 書類の基準日（YYYY-MM-DD、税理士連携日とは別）
  uploaded_at: string;                 // Storage 連携日
  uploaded_by: string | null;          // auth.users.id
  note: string | null;                 // 備考（例: '※訂正版あり'）
  mime_type: string;                   // 'application/pdf' 等
  file_size_bytes: number;             // 参考用
  created_at: string;
  updated_at: string;
};
```

---

## 5. 実装ステップ

### Step 1: テーブル作成 migration
```sql
-- supabase/migrations/20260424_02_forest_tax_files.sql
BEGIN;

CREATE TYPE forest_tax_file_status AS ENUM ('zanntei', 'kakutei');

CREATE TABLE forest_tax_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text NOT NULL REFERENCES companies(id) ON UPDATE CASCADE,
  doc_name        text NOT NULL,
  file_name       text NOT NULL,
  storage_path    text NOT NULL UNIQUE,      -- Storage パスは一意
  status          forest_tax_file_status NOT NULL DEFAULT 'zanntei',
  doc_date        date,                      -- 書類基準日（nullable）
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_by     uuid REFERENCES auth.users(id),
  note            text,
  mime_type       text NOT NULL,
  file_size_bytes bigint CHECK (file_size_bytes >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE forest_tax_files IS
  'Forest 税理士連携ファイルのメタデータ。実体は Storage bucket forest-tax/ に格納';
COMMENT ON COLUMN forest_tax_files.status IS
  '暫定(zanntei) = 作成中、確定(kakutei) = 税理士確認済';
COMMENT ON COLUMN forest_tax_files.doc_date IS
  '書類の基準日。年次書類なら期末日、月次なら月末日など';

-- インデックス
CREATE INDEX forest_tax_files_company_idx
  ON forest_tax_files (company_id, uploaded_at DESC);

CREATE INDEX forest_tax_files_status_idx
  ON forest_tax_files (status);

CREATE INDEX forest_tax_files_doc_date_idx
  ON forest_tax_files (doc_date DESC)
  WHERE doc_date IS NOT NULL;

-- updated_at トリガ（既存 P08 と同パターン）
CREATE OR REPLACE FUNCTION forest_tax_files_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER forest_tax_files_touch_updated_at_trg
  BEFORE UPDATE ON forest_tax_files
  FOR EACH ROW
  EXECUTE FUNCTION forest_tax_files_touch_updated_at();

-- RLS
ALTER TABLE forest_tax_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY ftf_select ON forest_tax_files FOR SELECT USING (forest_is_user());
CREATE POLICY ftf_insert ON forest_tax_files FOR INSERT WITH CHECK (forest_is_admin());
CREATE POLICY ftf_update ON forest_tax_files FOR UPDATE
  USING (forest_is_admin()) WITH CHECK (forest_is_admin());
CREATE POLICY ftf_delete ON forest_tax_files FOR DELETE USING (forest_is_admin());

COMMIT;
```

### Step 2: Storage bucket 作成 SQL + Dashboard 操作
```sql
-- supabase/migrations/20260424_03_forest_tax_storage.sql
BEGIN;

-- Bucket メタ（Dashboard で先に物理作成推奨）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('forest-tax', 'forest-tax', false, 52428800,
   ARRAY[
     'application/pdf',
     'application/vnd.ms-excel',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'text/csv',
     'image/jpeg',
     'image/png'
   ])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: SELECT = forest_user / INSERT・UPDATE・DELETE = admin+
CREATE POLICY ft_read_forest_user
  ON storage.objects FOR SELECT
  USING (bucket_id = 'forest-tax' AND forest_is_user());

CREATE POLICY ft_insert_admin
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'forest-tax' AND forest_is_admin());

CREATE POLICY ft_update_admin
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'forest-tax' AND forest_is_admin())
  WITH CHECK (bucket_id = 'forest-tax' AND forest_is_admin());

CREATE POLICY ft_delete_admin
  ON storage.objects FOR DELETE
  USING (bucket_id = 'forest-tax' AND forest_is_admin());

COMMIT;
```

**東海林さん Dashboard 操作**:
1. Dashboard → Storage → "New bucket"
2. `forest-tax`（Public: OFF, Size: 50MB, MIME: PDF/xlsx/xls/csv/jpg/png）

### Step 3: queries.ts / mutations.ts 追加（本 spec は interface 宣言のみ、実装は T-F5-02 でも可）
```typescript
// src/app/forest/_lib/queries.ts に追加
import type { TaxFile } from './types';

export async function fetchTaxFiles(companyId?: string): Promise<TaxFile[]> {
  let query = supabase
    .from('forest_tax_files')
    .select('*')
    .order('uploaded_at', { ascending: false });
  if (companyId) query = query.eq('company_id', companyId);

  const { data, error } = await query;
  if (error) throw new Error(`fetchTaxFiles: ${error.message}`);
  return data as TaxFile[];
}

export async function createTaxFileSignedUrl(storagePath: string, expiresInSec = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from('forest-tax').createSignedUrl(storagePath, expiresInSec);
  if (error) throw new Error(`createTaxFileSignedUrl: ${error.message}`);
  return data.signedUrl;
}
```

### Step 4: 検証
```sql
-- Bucket 確認
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'forest-tax';

-- Policy 確認
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'ft%';

-- テーブル確認
SELECT * FROM forest_tax_files LIMIT 0;  -- 列定義の確認のみ

-- ダミー行投入（admin として）
INSERT INTO forest_tax_files
  (company_id, doc_name, file_name, storage_path, status, mime_type, file_size_bytes)
VALUES
  ('hyuaran', 'テストファイル', 'test.pdf', 'test/test.pdf', 'zanntei', 'application/pdf', 12345);
SELECT * FROM forest_tax_files;
DELETE FROM forest_tax_files WHERE doc_name = 'テストファイル';
```

---

## 6. データソース

| 種類 | 情報源 | 操作 |
|---|---|---|
| Supabase Table | `forest_tax_files`（新規）| SELECT by company_id / status / doc_date |
| Storage | `forest-tax/{company_id}/{file_name}` | download / createSignedUrl |
| 既存 Table | `companies` | FK 参照 |

**Storage パス規則**:
- `{company_id}/{doc_name}_{upload_timestamp}.{ext}` を推奨（例: `hyuaran/2024_kakutei_20260424.pdf`）
- 日本語ファイル名: URL encoding 対応必須（T-F5-03 アップロード UI 側で処理）

---

## 7. UI 仕様

本 spec は UI を含まない。T-F5-02 TaxFilesList / T-F5-03 Upload UI を参照。

---

## 8. エラーハンドリング

| # | エラー | 対応 |
|---|---|---|
| E1 | テーブル既存（再実行時）| `CREATE TABLE IF NOT EXISTS` ではなく **failif exists** で明示失敗 → 手動で DROP or MIGRATION 番号管理 |
| E2 | `companies.id` が参照切れ | FK 制約で INSERT 拒否 |
| E3 | Storage bucket 容量逼迫 | 50MB 超のファイルはアップロード拒否 → 東海林さんへアラート |
| E4 | 日本語ファイル名の storage_path エンコード事故 | URL encoding で対処（T-F5-03 で実装）|
| E5 | uploaded_by が NULL | auth.uid() 欠落時の保険。RLS で admin 判定されていれば実害なし |

---

## 9. 権限・RLS

### テーブル `forest_tax_files`
| 操作 | 許可ロール |
|---|---|
| SELECT | `forest_is_user()` |
| INSERT | `forest_is_admin()` |
| UPDATE | `forest_is_admin()` |
| DELETE | `forest_is_admin()` |

### Storage bucket `forest-tax`
同等（SQL 上も対称パターン）。

**判5 B 案準拠**: 税理士が直接ファイル投入する経路は**設けない**。社内担当者（admin+）が代理アップロード。

---

## 10. テスト観点（§16 7種テスト）

| # | テスト種別 | 観点 |
|---|---|---|
| 1 | 機能網羅 | テーブル作成・bucket 作成・Policy 適用の全確認 |
| 2 | エッジケース | NULL doc_date、長い doc_name（255 char）、巨大 file_size_bytes |
| 3 | **権限** | forest_user / admin / 非ユーザーの 3 ロール × 4 操作 |
| 4 | データ境界 | FK 違反（存在しない company_id） |
| 6 | Console | Supabase Logs にエラーなし |

---

## 11. 関連参照

- **P07 §4.5**: F5 Tax Files 差分、判5 B 案
- **T-F6-01** [forest-t-f6-01-storage-buckets.md](2026-04-24-forest-t-f6-01-storage-buckets.md): Storage bucket 命名パターン、RLS パターン
- **T-F5-02** [forest-t-f5-02-tax-files-list-ui.md](2026-04-24-forest-t-f5-02-tax-files-list-ui.md): 本 spec を前提とする UI
- **T-F5-03** [forest-t-f5-03-tax-files-upload-ui.md](2026-04-24-forest-t-f5-03-tax-files-upload-ui.md): 代理入力 UI
- **P08 `forest_hankanhi`**: updated_at トリガのパターン、同じ構成で作成

---

## 12. 判断保留

| # | 論点 | a-auto スタンス |
|---|---|---|
| 判1 | 論理削除 vs 物理削除 | **物理削除**で開始。誤削除対策は Supabase 日次 DB バックアップに委譲 |
| 判2 | `status` に 'archived' を追加するか | **Phase A では 2 値**、過去分非表示は UI でフィルタ |
| 判3 | tags カラムで分類 | 現状なし。必要なら将来 `forest_tax_file_tags` 子テーブル |
| 判4 | uploaded_by が NULL の許容 | 現状 nullable（service_role 経由 INSERT の保険）、将来 NOT NULL 強化検討 |
| 判5 | 版管理（同じ doc_name で上書き）| 現状 upsert 方針、Storage 側で ファイル名 + timestamp で事実上の履歴残す |

— end of T-F5-01 spec —
