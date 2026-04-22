-- ============================================================
-- Garden Bud — Supabase Schema
-- ============================================================
-- 作成: 2026-04-22
--
-- 目的:
--   Bud（経理・収支）モジュール固有のテーブル群を作成する。
--   マスタ系は Root（root_*）を参照するため、Bud では作らない。
--
-- 依存:
--   scripts/root-schema.sql（7マスタ）と
--   scripts/root-auth-schema.sql（user_id / garden_role / birthday / ヘルパー関数）
--   が先に適用されていること。
--
-- 冪等性:
--   CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS を使い
--   何度実行しても同じ結果になる。
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

-- ============================================================
-- 1. bud_users（Bud アクセス権限）
-- ============================================================
-- admin/super_admin は自動で Bud アクセス可。それ以外は本テーブルに
-- is_active=true で明示登録されたユーザーのみ Bud にアクセスできる。
CREATE TABLE IF NOT EXISTS bud_users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    text NOT NULL UNIQUE REFERENCES root_employees(employee_id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bud_role       text NOT NULL CHECK (bud_role IN ('admin','approver','staff')),
  is_active      boolean NOT NULL DEFAULT true,
  assigned_by    uuid REFERENCES auth.users(id),
  assigned_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bud_users IS 'Bud アクセス権限テーブル。明示登録または admin/super_admin が自動許可。';
COMMENT ON COLUMN bud_users.bud_role IS 'Bud内役割: admin=全操作 / approver=承認 / staff=起票';

-- ============================================================
-- 2. bud_transfers（振込管理）
-- ============================================================
CREATE TABLE IF NOT EXISTS bud_transfers (
  transfer_id              text PRIMARY KEY,          -- FRK-2026-04-0001
  status                   text NOT NULL DEFAULT '下書き'
    CHECK (status IN ('下書き','確認済み','承認待ち','承認済み','CSV出力済み','振込完了','差戻し')),
  data_source              text,                      -- 紙スキャン/デジタル入力/CSVインポート
  transfer_type            text,                      -- 給与/外注費/経費精算/その他
  request_date             date NOT NULL DEFAULT CURRENT_DATE,
  due_date                 date,
  scheduled_date           date,
  executed_date            date,
  company_id               text REFERENCES root_companies(company_id),
  source_account_id        text REFERENCES root_bank_accounts(account_id),
  vendor_id                text REFERENCES root_vendors(vendor_id),
  payee_name               text NOT NULL,
  payee_bank_name          text,
  payee_bank_code          text,
  payee_branch_name        text,
  payee_branch_code        text,
  payee_account_type       text,
  payee_account_number     text,
  payee_account_holder_kana text,
  fee_bearer               text DEFAULT '当方負担',
  amount                   integer NOT NULL,
  description              text,
  created_by               uuid REFERENCES auth.users(id),
  confirmed_by             uuid REFERENCES auth.users(id),
  confirmed_at             timestamptz,
  approved_by              uuid REFERENCES auth.users(id),
  approved_at              timestamptz,
  csv_exported_by          uuid REFERENCES auth.users(id),
  csv_exported_at          timestamptz,
  executed_by              uuid REFERENCES auth.users(id),
  rejection_reason         text,
  batch_code               text,                      -- BATCH-2026-04-25
  duplicate_flag           boolean NOT NULL DEFAULT false,
  duplicate_confirmed      boolean NOT NULL DEFAULT false,
  scan_image_url           text,
  invoice_pdf_url          text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bud_transfers IS '振込依頼管理。kintone の振込データ移行先。';

-- ============================================================
-- 3. bud_statements（入出金明細）
-- ============================================================
CREATE TABLE IF NOT EXISTS bud_statements (
  statement_id       text PRIMARY KEY,                -- TXN-2026-04-0001
  company_id         text REFERENCES root_companies(company_id),
  account_id         text REFERENCES root_bank_accounts(account_id),
  transaction_date   date NOT NULL,
  transaction_type   text,                            -- 入金/出金/振替
  deposit_amount     integer NOT NULL DEFAULT 0,
  withdrawal_amount  integer NOT NULL DEFAULT 0,
  balance            integer,
  bank_description   text,
  counterparty_name  text,
  vendor_id          text REFERENCES root_vendors(vendor_id),
  reconcile_status   text NOT NULL DEFAULT '未照合'
    CHECK (reconcile_status IN ('未照合','照合済み','対象外')),
  reconcile_transfer_id text REFERENCES bud_transfers(transfer_id),
  reconciled_at      timestamptz,
  reconciled_by      uuid REFERENCES auth.users(id),
  import_datetime    timestamptz,
  import_filename    text,
  import_batch_id    text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bud_statements IS '銀行入出金明細。CSV取込で INSERT、振込レコードと照合する。';

-- ============================================================
-- 4. bud_salary_batches（給与処理バッチ）
-- ============================================================
CREATE TABLE IF NOT EXISTS bud_salary_batches (
  batch_id      text PRIMARY KEY,                     -- SALBATCH-2026-04-COMP001
  target_month  text NOT NULL,                        -- 2026-04
  status        text NOT NULL DEFAULT '計算中'
    CHECK (status IN ('計算中','課長確認','東海林確認','確定','振込連携済')),
  company_id    text REFERENCES root_companies(company_id),
  payment_date  date,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bud_salary_batches IS '月次給与処理バッチ。法人×対象月単位で管理。';

-- ============================================================
-- 5. bud_salary_details（給与明細）
-- ============================================================
CREATE TABLE IF NOT EXISTS bud_salary_details (
  detail_id             text PRIMARY KEY,             -- SAL-2026-04-0001
  batch_id              text REFERENCES bud_salary_batches(batch_id) ON DELETE CASCADE,
  employee_id           text REFERENCES root_employees(employee_id),
  employee_name         text,
  company_id            text REFERENCES root_companies(company_id),
  employment_type       text,
  target_month          text,
  payment_date          date,
  status                text NOT NULL DEFAULT '計算中'
    CHECK (status IN ('計算中','確認待ち','確定')),
  -- 支給（共通）
  base_salary           integer NOT NULL DEFAULT 0,
  overtime_pay          integer NOT NULL DEFAULT 0,
  night_overtime_pay    integer NOT NULL DEFAULT 0,
  paid_leave_pay        integer NOT NULL DEFAULT 0,
  commute_taxable       integer NOT NULL DEFAULT 0,
  commute_nontaxable    integer NOT NULL DEFAULT 0,
  absence_deduction     integer NOT NULL DEFAULT 0,
  late_early_deduction  integer NOT NULL DEFAULT 0,
  -- 支給（正社員）
  executive_pay         integer NOT NULL DEFAULT 0,
  position_allowance    integer NOT NULL DEFAULT 0,
  sales_allowance       integer NOT NULL DEFAULT 0,
  travel_allowance      integer NOT NULL DEFAULT 0,
  travel_daily_allowance integer NOT NULL DEFAULT 0,
  travel_lodging_allowance integer NOT NULL DEFAULT 0,
  -- 支給（アルバイト）
  ap_incentive          integer NOT NULL DEFAULT 0,
  president_incentive   integer NOT NULL DEFAULT 0,
  count_incentive       integer NOT NULL DEFAULT 0,
  training_allowance    integer NOT NULL DEFAULT 0,
  office_allowance      integer NOT NULL DEFAULT 0,
  other_allowance       integer NOT NULL DEFAULT 0,
  -- 控除
  health_insurance      integer NOT NULL DEFAULT 0,
  nursing_insurance     integer NOT NULL DEFAULT 0,
  childcare_support     integer NOT NULL DEFAULT 0,
  pension_insurance     integer NOT NULL DEFAULT 0,
  employment_insurance  integer NOT NULL DEFAULT 0,
  income_tax            integer NOT NULL DEFAULT 0,
  resident_tax          integer NOT NULL DEFAULT 0,
  year_end_adjustment   integer NOT NULL DEFAULT 0,
  rakuten_advance        integer NOT NULL DEFAULT 0,
  company_housing       integer NOT NULL DEFAULT 0,
  adjustment_insurance  integer NOT NULL DEFAULT 0,
  other_deduction       integer NOT NULL DEFAULT 0,
  -- 合計
  total_payment         integer NOT NULL DEFAULT 0,
  total_deduction       integer NOT NULL DEFAULT 0,
  net_payment           integer NOT NULL DEFAULT 0,
  -- 参照（計算根拠の追跡用）
  insurance_id          text REFERENCES root_insurance(insurance_id),
  attendance_id         text REFERENCES root_attendance(attendance_id),
  remarks               text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE bud_salary_details IS '給与明細。バッチ×従業員単位。Garden-Tree の給与明細配信元。';

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION bud_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bud_users_updated_at ON bud_users;
CREATE TRIGGER trg_bud_users_updated_at
  BEFORE UPDATE ON bud_users
  FOR EACH ROW EXECUTE FUNCTION bud_update_updated_at();

DROP TRIGGER IF EXISTS trg_bud_transfers_updated_at ON bud_transfers;
CREATE TRIGGER trg_bud_transfers_updated_at
  BEFORE UPDATE ON bud_transfers
  FOR EACH ROW EXECUTE FUNCTION bud_update_updated_at();

DROP TRIGGER IF EXISTS trg_bud_salary_batches_updated_at ON bud_salary_batches;
CREATE TRIGGER trg_bud_salary_batches_updated_at
  BEFORE UPDATE ON bud_salary_batches
  FOR EACH ROW EXECUTE FUNCTION bud_update_updated_at();

DROP TRIGGER IF EXISTS trg_bud_salary_details_updated_at ON bud_salary_details;
CREATE TRIGGER trg_bud_salary_details_updated_at
  BEFORE UPDATE ON bud_salary_details
  FOR EACH ROW EXECUTE FUNCTION bud_update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bud_users_employee   ON bud_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_bud_users_user_id    ON bud_users(user_id);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_status    ON bud_transfers(status);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_company   ON bud_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_scheduled ON bud_transfers(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bud_statements_company  ON bud_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_bud_statements_date     ON bud_statements(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bud_salary_details_batch    ON bud_salary_details(batch_id);
CREATE INDEX IF NOT EXISTS idx_bud_salary_details_employee ON bud_salary_details(employee_id);

-- ============================================================
-- Row Level Security 有効化（ポリシー本体は bud-rls.sql 参照）
-- ============================================================
ALTER TABLE bud_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud_transfers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud_statements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud_salary_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bud_salary_details ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- 以下をSQL Editor で追加実行して適用確認すること：
--
-- SELECT tablename FROM pg_tables WHERE tablename LIKE 'bud_%' ORDER BY tablename;
-- （期待: bud_salary_batches / bud_salary_details / bud_statements / bud_transfers / bud_users）
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'bud_users'::regclass AND contype = 'c';
