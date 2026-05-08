-- ============================================================
-- Bud A-06: 明細管理 migration
-- ============================================================
-- 前提: scripts/bud-schema.sql + scripts/bud-rls.sql 適用済
-- 追加: bud_statements + bud_statement_import_batches + RLS
-- 注意:
--   spec の bud_transfers(id) / bud_is_user / bud_has_role は不存在のため、
--   実 PK transfer_id / 既存 helper bud_has_access / bud_is_approver_or_above を使用。
--   root_bank_accounts.account_id は text のため bank_account_id も text。

-- ============================================================
-- 1. bud_statement_import_batches（取込バッチ管理）
-- ============================================================

CREATE TABLE IF NOT EXISTS bud_statement_import_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id   text NOT NULL REFERENCES root_bank_accounts(account_id),
  source_type       text NOT NULL CHECK (source_type IN ('rakuten_csv', 'mizuho_csv', 'paypay_csv', 'manual')),
  file_name         text NOT NULL,
  file_storage_path text,
  row_count         int NOT NULL DEFAULT 0,
  success_count     int NOT NULL DEFAULT 0,
  error_count       int NOT NULL DEFAULT 0,
  skipped_count     int NOT NULL DEFAULT 0,
  auto_matched_count int NOT NULL DEFAULT 0,
  imported_at       timestamptz NOT NULL DEFAULT now(),
  imported_by       uuid NOT NULL REFERENCES auth.users(id),
  status            text CHECK (status IN ('completed', 'partial', 'failed')) DEFAULT 'completed',
  error_summary     text
);

CREATE INDEX IF NOT EXISTS bud_statement_import_batches_account_idx
  ON bud_statement_import_batches (bank_account_id, imported_at DESC);

COMMENT ON TABLE bud_statement_import_batches IS
  '銀行明細 CSV 取込のバッチ単位記録（監査用）';

-- ============================================================
-- 2. bud_statements（入出金明細）
-- ============================================================

CREATE TABLE IF NOT EXISTS bud_statements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id     text NOT NULL REFERENCES root_bank_accounts(account_id),

  -- 明細基本情報
  transaction_date    date NOT NULL,
  transaction_time    time,
  amount              bigint NOT NULL,            -- 正=入金、負=出金
  balance_after       bigint,
  description         text NOT NULL,
  transaction_type    text,
  memo                text,

  -- 照合（spec の bud_transfers(id) は不存在のため transfer_id (text) で参照）
  matched_transfer_id text REFERENCES bud_transfers(transfer_id),
  matched_at          timestamptz,
  matched_by          uuid REFERENCES auth.users(id),
  match_confidence    text CHECK (match_confidence IN ('exact', 'high', 'manual')),

  -- 費目（経費時、Phase A では手動）
  category            text,
  subcategory         text,

  -- CC 明細連携（A-08 で実装、ここでは前方参照として nullable text）
  cc_meisai_id        text,

  -- 取込情報
  source_type         text NOT NULL CHECK (source_type IN ('rakuten_csv', 'mizuho_csv', 'paypay_csv', 'manual')),
  imported_batch_id   uuid REFERENCES bud_statement_import_batches(id),
  raw_row             jsonb,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- 重複取込防止: 同一銀行口座・日時・金額・摘要で UNIQUE
  CONSTRAINT uq_statement_dedupe
    UNIQUE NULLS NOT DISTINCT (bank_account_id, transaction_date, transaction_time, amount, description)
);

CREATE INDEX IF NOT EXISTS bud_statements_account_date_idx
  ON bud_statements (bank_account_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS bud_statements_matched_idx
  ON bud_statements (matched_transfer_id)
  WHERE matched_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bud_statements_unmatched_outflow_idx
  ON bud_statements (transaction_date DESC)
  WHERE matched_transfer_id IS NULL AND amount < 0;

COMMENT ON TABLE bud_statements IS
  '銀行入出金明細。CSV 取込 or 手動入力。amount は正=入金、負=出金。';
COMMENT ON COLUMN bud_statements.matched_transfer_id IS
  'bud_transfers.transfer_id への参照（FK-/CB- 形式テキスト）';
COMMENT ON COLUMN bud_statements.raw_row IS
  '元 CSV 行を jsonb で保持（取込結果の再現性確保）';

-- ============================================================
-- 3. RLS: bud_statements
-- ============================================================

ALTER TABLE bud_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bs_select ON bud_statements;
CREATE POLICY bs_select ON bud_statements
  FOR SELECT
  USING (bud_has_access());

DROP POLICY IF EXISTS bs_insert ON bud_statements;
CREATE POLICY bs_insert ON bud_statements
  FOR INSERT
  WITH CHECK (bud_has_access());

DROP POLICY IF EXISTS bs_update ON bud_statements;
CREATE POLICY bs_update ON bud_statements
  FOR UPDATE
  USING (bud_is_approver_or_above())
  WITH CHECK (bud_is_approver_or_above());

DROP POLICY IF EXISTS bs_delete ON bud_statements;
CREATE POLICY bs_delete ON bud_statements
  FOR DELETE
  USING (bud_is_admin());

-- ============================================================
-- 4. RLS: bud_statement_import_batches
-- ============================================================

ALTER TABLE bud_statement_import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bsib_select ON bud_statement_import_batches;
CREATE POLICY bsib_select ON bud_statement_import_batches
  FOR SELECT
  USING (bud_has_access());

DROP POLICY IF EXISTS bsib_insert ON bud_statement_import_batches;
CREATE POLICY bsib_insert ON bud_statement_import_batches
  FOR INSERT
  WITH CHECK (bud_has_access());

DROP POLICY IF EXISTS bsib_no_update ON bud_statement_import_batches;
CREATE POLICY bsib_no_update ON bud_statement_import_batches
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS bsib_no_delete ON bud_statement_import_batches;
CREATE POLICY bsib_no_delete ON bud_statement_import_batches
  FOR DELETE
  USING (false);

-- ============================================================
-- 5. 確認クエリ（東海林さん手動実行用）
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'bud_statements'
--   ORDER BY ordinal_position;
--
-- SELECT count(*) FROM bud_statements WHERE matched_transfer_id IS NOT NULL;
