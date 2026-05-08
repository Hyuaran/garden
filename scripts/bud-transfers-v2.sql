-- ============================================================
-- Garden Bud — bud_transfers v2（Phase 1b 用スキーマ拡張）
-- ============================================================
-- 作成: 2026-04-23
-- 目的:
--   Phase 1b（振込管理 Kintone 置換）に必要なカラムを追加する。
--   既存 bud_transfers（Phase 0）を破壊せず、ALTER TABLE 増分変更のみ。
--
-- 変更概要:
--   1. 振込種別（通常/キャッシュバック）
--   2. 依頼会社・実行会社（社内立替対応）
--   3. キャッシュバック専用フィールド（申込者・商材等）
--   4. 受取人相違確認フラグ
--   5. 費用分類・勘定科目（Phase 2a/5 で使用）
--   6. キャッシュバック申請ステータス
--   7. 重複検出キー（GENERATED 列）と UNIQUE INDEX
--
-- 依存: scripts/bud-schema.sql（Phase 0）が先に適用済みであること
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

-- ============================================================
-- 1. 振込種別
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS transfer_category text
    CHECK (transfer_category IN ('regular', 'cashback'));

COMMENT ON COLUMN bud_transfers.transfer_category IS
  'regular=取引先への通常振込（FK-）、cashback=販促費キャッシュバック（CB-）';

-- ============================================================
-- 2. 依頼会社・実行会社（社内立替対応）
-- ============================================================
-- 既存 company_id は残し、後方互換のため廃止せず（将来的に execute_company_id へ統合予定）。
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS request_company_id text
    REFERENCES root_companies(company_id),
  ADD COLUMN IF NOT EXISTS execute_company_id text
    REFERENCES root_companies(company_id);

COMMENT ON COLUMN bud_transfers.request_company_id IS
  '依頼会社（費用計上先）。execute_company_id と異なる場合は社内立替。';
COMMENT ON COLUMN bud_transfers.execute_company_id IS
  '実行会社（振込元口座を持つ会社）。source_account_id の所属会社と一致する想定。';

-- ============================================================
-- 3. キャッシュバック専用フィールド
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS cashback_applicant_name_kana text,
  ADD COLUMN IF NOT EXISTS cashback_applicant_name text,
  ADD COLUMN IF NOT EXISTS cashback_applicant_phone text,
  ADD COLUMN IF NOT EXISTS cashback_customer_id text,
  ADD COLUMN IF NOT EXISTS cashback_order_date date,
  ADD COLUMN IF NOT EXISTS cashback_opened_date date,
  ADD COLUMN IF NOT EXISTS cashback_product_name text,
  ADD COLUMN IF NOT EXISTS cashback_channel_name text,
  ADD COLUMN IF NOT EXISTS cashback_partner_code text;

-- ============================================================
-- 4. キャッシュバック申請ステータス（Phase 1c Leaf 連携で使用）
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS cashback_application_status text
    CHECK (cashback_application_status IN (
      'pending',       -- 承認待ち
      'under_review',  -- 検討中
      'approved',      -- 承認済み
      'rejected',      -- 却下
      'returned'       -- 差戻し
    ));

COMMENT ON COLUMN bud_transfers.cashback_application_status IS
  'キャッシュバック申請のステータス（Phase 1c Leaf から申請が来るたびに更新）';

-- ============================================================
-- 5. 受取人相違確認フラグ
-- ============================================================
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS payee_mismatch_confirmed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN bud_transfers.payee_mismatch_confirmed IS
  '受取人名（payee_name）と口座名義カナ（payee_account_holder_kana）が別人の場合、ユーザー確認済みフラグ';

-- ============================================================
-- 6. 費用分類・勘定科目（Phase 2a/5 で seed 後に利用）
-- ============================================================
-- 参照先テーブル（root_expense_categories / root_forest_accounts）は Phase 2c で作成予定。
-- ここでは外部キーなしで text カラムのみ追加（前方互換）。
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS expense_category_id text,
  ADD COLUMN IF NOT EXISTS forest_account_id text;

COMMENT ON COLUMN bud_transfers.expense_category_id IS
  'Phase 2c で作成する root_expense_categories への参照（現時点は text のみ、FK は将来追加）';
COMMENT ON COLUMN bud_transfers.forest_account_id IS
  'Phase 2c で作成する root_forest_accounts への参照（現時点は text のみ、FK は将来追加）';

-- ============================================================
-- 7. 重複検出キー（GENERATED 列）と UNIQUE INDEX
-- ============================================================
-- 支払期日 + 受取銀行・支店・口座 + 金額 を連結したキー。
-- 既存の同じ振込依頼を二重登録しようとした場合に DB レベルで弾く。
-- ただし duplicate_flag = true の場合（意図的な重複登録）は除外。

ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS duplicate_key text GENERATED ALWAYS AS (
    concat_ws(',',
      to_char(scheduled_date, 'YYYYMMDD'),
      payee_bank_code,
      payee_branch_code,
      payee_account_number,
      amount::text
    )
  ) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bud_transfers_duplicate_key
  ON bud_transfers(duplicate_key)
  WHERE duplicate_flag = false AND duplicate_key IS NOT NULL;

COMMENT ON INDEX idx_bud_transfers_duplicate_key IS
  '重複振込防止用の部分ユニークインデックス。duplicate_flag=true の意図的重複は除外。';

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'bud_transfers'
--   ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bud_transfers';
