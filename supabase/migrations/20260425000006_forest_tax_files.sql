-- =====================================================================
-- Garden-Forest Tax Files migration (T-F5-01)
-- 税理士連携ファイル（PDF/xlsx 等）のメタデータ。
-- 実体は Storage bucket forest-tax/ に格納（別 migration で bucket 作成）。
-- 判5 = B 案：社内担当者が代理入力（admin+ のみ書込）。
--
-- 作成: 2026-04-25 (a-forest, T-F5 閲覧着手分)
-- 前提: companies, forest_is_user(), forest_is_admin() が存在すること
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. ENUM
-- ---------------------------------------------------------------------
CREATE TYPE forest_tax_file_status AS ENUM ('zantei', 'kakutei');

-- ---------------------------------------------------------------------
-- 2. テーブル定義
-- ---------------------------------------------------------------------
CREATE TABLE forest_tax_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      text NOT NULL REFERENCES companies(id) ON UPDATE CASCADE,
  doc_name        text NOT NULL,                            -- 表示用ドキュメント名
  file_name       text NOT NULL,                            -- 元ファイル名（Storage パスとは別）
  storage_path    text NOT NULL UNIQUE,                     -- Storage 内パス、一意
  status          forest_tax_file_status NOT NULL DEFAULT 'zantei',
  doc_date        date,                                     -- 書類基準日（年次=期末日 等）
  uploaded_at     timestamptz NOT NULL DEFAULT now(),
  uploaded_by     uuid REFERENCES auth.users(id),
  note            text,                                     -- 備考（'※訂正版あり' 等）
  mime_type       text NOT NULL,
  file_size_bytes bigint CHECK (file_size_bytes >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE forest_tax_files IS
  'Forest 税理士連携ファイルのメタデータ。実体は Storage bucket forest-tax/ に格納';
COMMENT ON COLUMN forest_tax_files.status IS
  '暫定(zantei) = 作成中、確定(kakutei) = 税理士確認済';
COMMENT ON COLUMN forest_tax_files.doc_date IS
  '書類の基準日。年次書類なら期末日、月次なら月末日など。連携日 (uploaded_at) とは別';

-- ---------------------------------------------------------------------
-- 3. インデックス
-- ---------------------------------------------------------------------
CREATE INDEX forest_tax_files_company_idx
  ON forest_tax_files (company_id, uploaded_at DESC);

CREATE INDEX forest_tax_files_status_idx
  ON forest_tax_files (status);

CREATE INDEX forest_tax_files_doc_date_idx
  ON forest_tax_files (doc_date DESC)
  WHERE doc_date IS NOT NULL;

-- ---------------------------------------------------------------------
-- 4. updated_at トリガ（既存 P08 と同パターン）
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 5. RLS（テーブル側）
-- 方針:
--   SELECT          : forest_is_user()  - 全 forest_users 登録ユーザー閲覧可
--   INSERT/UPDATE/DELETE : forest_is_admin() - admin/super_admin のみ書込可
-- 判5 B 案準拠：税理士直接書込経路は設けない
-- ---------------------------------------------------------------------
ALTER TABLE forest_tax_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY ftf_select ON forest_tax_files
  FOR SELECT
  USING (forest_is_user());

CREATE POLICY ftf_insert ON forest_tax_files
  FOR INSERT
  WITH CHECK (forest_is_admin());

CREATE POLICY ftf_update ON forest_tax_files
  FOR UPDATE
  USING (forest_is_admin())
  WITH CHECK (forest_is_admin());

CREATE POLICY ftf_delete ON forest_tax_files
  FOR DELETE
  USING (forest_is_admin());

COMMIT;

-- =====================================================================
-- ROLLBACK SQL（不具合時のクリーンアップ）
-- 本番環境では必ず pg_dump でバックアップ取得後に実行。
-- =====================================================================
/*
BEGIN;
DROP TRIGGER IF EXISTS forest_tax_files_touch_updated_at_trg ON forest_tax_files;
DROP FUNCTION IF EXISTS forest_tax_files_touch_updated_at();
DROP TABLE IF EXISTS forest_tax_files CASCADE;
DROP TYPE IF EXISTS forest_tax_file_status;
COMMIT;
*/
