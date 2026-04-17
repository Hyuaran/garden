-- ============================================================
-- Garden Root — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 1. root_companies (法人マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_companies (
  company_id    text PRIMARY KEY,                          -- 例: COMP-001
  company_name  text NOT NULL,                             -- 例: 株式会社ヒュアラン
  company_name_kana text NOT NULL DEFAULT '',               -- 全角カナ
  corporate_number text,                                    -- 法人番号（13桁）
  representative text NOT NULL DEFAULT '',                  -- 代表者名
  address       text NOT NULL DEFAULT '',                   -- 本店所在地
  phone         text,                                       -- 電話番号
  default_bank  text NOT NULL DEFAULT '楽天銀行',            -- 楽天銀行/みずほ銀行/PayPay銀行
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_companies IS '法人マスタ（6社）';

-- ============================================================
-- 2. root_bank_accounts (銀行口座マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_bank_accounts (
  account_id    text PRIMARY KEY,                          -- 例: ACC-001
  company_id    text NOT NULL REFERENCES root_companies(company_id),
  bank_name     text NOT NULL,                             -- 例: 楽天銀行
  bank_code     text NOT NULL,                             -- 金融機関コード（4桁）
  branch_name   text NOT NULL,                             -- 支店名
  branch_code   text NOT NULL,                             -- 支店コード（3桁）
  account_type  text NOT NULL DEFAULT '普通',               -- 普通/当座
  account_number text NOT NULL,                             -- 口座番号（7桁）
  account_holder text NOT NULL,                             -- 口座名義
  purpose       text,                                       -- メイン/給与/経費等
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_bank_accounts IS '銀行口座マスタ（法人ごとの振込元口座）';

-- ============================================================
-- 3. root_vendors (取引先マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_vendors (
  vendor_id     text PRIMARY KEY,                          -- 例: VND-001
  vendor_name   text NOT NULL,                             -- 例: 株式会社タイニー
  vendor_name_kana text NOT NULL DEFAULT '',                -- 全角カナ
  vendor_type   text,                                       -- 外注先/仕入先/その他
  bank_name     text NOT NULL DEFAULT '',                   -- 振込先銀行
  bank_code     text NOT NULL DEFAULT '',                   -- 金融機関コード（4桁）
  branch_name   text NOT NULL DEFAULT '',                   -- 支店名
  branch_code   text NOT NULL DEFAULT '',                   -- 支店コード（3桁）
  account_type  text NOT NULL DEFAULT '普通',               -- 普通/当座
  account_number text NOT NULL DEFAULT '',                   -- 口座番号（7桁）
  account_holder_kana text NOT NULL DEFAULT '',              -- 口座名義カナ（全角）
  fee_bearer    text NOT NULL DEFAULT '当方負担',            -- 当方負担/先方負担
  company_id    text REFERENCES root_companies(company_id), -- 主に取引する法人（任意）
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_vendors IS '取引先マスタ（振込先口座情報）';

-- ============================================================
-- 4. root_salary_systems (給与体系マスタ)
--    ※ root_employees より先に作成（FK 参照のため）
-- ============================================================
CREATE TABLE IF NOT EXISTS root_salary_systems (
  salary_system_id text PRIMARY KEY,                       -- 例: SAL-SYS-001
  system_name   text NOT NULL,                             -- 例: 正社員標準
  employment_type text NOT NULL,                            -- 正社員/アルバイト/共通
  base_salary_type text NOT NULL DEFAULT '月給',             -- 月給/時給/日給
  working_hours_day numeric(4,1) NOT NULL DEFAULT 7.0,      -- 所定労働時間（日）
  working_days_month numeric(4,1) NOT NULL DEFAULT 20.0,    -- 所定労働日数（月）
  overtime_rate  numeric(4,2) NOT NULL DEFAULT 1.25,        -- 残業単価倍率（法定外）
  night_overtime_rate numeric(4,2) NOT NULL DEFAULT 1.35,   -- 深夜
  holiday_overtime_rate numeric(4,2) NOT NULL DEFAULT 1.35, -- 休日
  allowances    jsonb,                                      -- 手当設定
  deductions    jsonb,                                      -- 控除設定
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_salary_systems IS '給与体系マスタ（雇用形態別計算ルール）';

-- ============================================================
-- 5. root_employees (従業員マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_employees (
  employee_id   text PRIMARY KEY,                          -- 例: EMP-0001
  employee_number text NOT NULL,                            -- 社内管理番号
  name          text NOT NULL,
  name_kana     text NOT NULL DEFAULT '',                   -- 全角カナ
  company_id    text NOT NULL REFERENCES root_companies(company_id),
  employment_type text NOT NULL DEFAULT '正社員',            -- 正社員/アルバイト
  salary_system_id text NOT NULL REFERENCES root_salary_systems(salary_system_id),
  hire_date     date NOT NULL,
  termination_date date,                                    -- 退職時に入力
  email         text NOT NULL DEFAULT '',                   -- 給与明細通知用
  -- 振込口座情報
  bank_name     text NOT NULL DEFAULT '',
  bank_code     text NOT NULL DEFAULT '',                   -- 4桁
  branch_name   text NOT NULL DEFAULT '',
  branch_code   text NOT NULL DEFAULT '',                   -- 3桁
  account_type  text NOT NULL DEFAULT '普通',               -- 普通/当座
  account_number text NOT NULL DEFAULT '',                   -- 7桁
  account_holder text NOT NULL DEFAULT '',
  account_holder_kana text NOT NULL DEFAULT '',              -- 全角カナ
  -- 外部ID連携
  kot_employee_id text,                                     -- キングオブタイムID
  mf_employee_id text,                                      -- MFクラウド給与ID
  insurance_type text NOT NULL DEFAULT '加入',               -- 加入/未加入/一部加入
  is_active     boolean NOT NULL DEFAULT true,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_employees IS '従業員マスタ（給与処理対象者）';

-- ============================================================
-- 6. root_insurance (社会保険マスタ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_insurance (
  insurance_id  text PRIMARY KEY,                          -- 例: INS-2026
  fiscal_year   text NOT NULL,                             -- 例: 2026
  effective_from date NOT NULL,
  effective_to  date,
  health_insurance_rate numeric(6,3) NOT NULL,              -- 健康保険料率（%）
  nursing_insurance_rate numeric(6,3) NOT NULL,             -- 介護保険料率（%）
  pension_rate  numeric(6,3) NOT NULL,                      -- 厚生年金保険料率（%）
  employment_insurance_rate numeric(6,3) NOT NULL,          -- 雇用保険料率（%）
  child_support_rate numeric(6,3) NOT NULL DEFAULT 0,       -- 子ども・子育て支援金率（%）
  grade_table   jsonb NOT NULL DEFAULT '[]'::jsonb,         -- 標準報酬月額の等級テーブル
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_insurance IS '社会保険マスタ（年度別料率・等級）';

-- ============================================================
-- 7. root_attendance (勤怠データ)
-- ============================================================
CREATE TABLE IF NOT EXISTS root_attendance (
  attendance_id text PRIMARY KEY,                          -- 例: ATT-2026-04-0001
  employee_id   text NOT NULL REFERENCES root_employees(employee_id),
  target_month  text NOT NULL,                             -- 例: 2026-04
  working_days  numeric(4,1) NOT NULL DEFAULT 0,           -- 出勤日数
  absence_days  numeric(4,1) NOT NULL DEFAULT 0,           -- 欠勤日数
  paid_leave_days numeric(4,1) NOT NULL DEFAULT 0,          -- 有給取得日数
  scheduled_hours numeric(6,1) NOT NULL DEFAULT 0,          -- 所定労働時間
  actual_hours  numeric(6,1) NOT NULL DEFAULT 0,           -- 実労働時間
  overtime_hours numeric(6,1) NOT NULL DEFAULT 0,           -- 所定外時間（平日）
  legal_overtime_hours numeric(6,1) NOT NULL DEFAULT 0,     -- 法定外時間（平日）
  night_hours   numeric(6,1) NOT NULL DEFAULT 0,           -- 深夜時間
  holiday_hours numeric(6,1) NOT NULL DEFAULT 0,           -- 休日出勤時間
  late_hours    numeric(6,1) NOT NULL DEFAULT 0,           -- 遅刻時間
  early_leave_hours numeric(6,1) NOT NULL DEFAULT 0,        -- 早退時間
  training_hours numeric(6,1),                              -- 研修時間（アルバイト用）
  office_hours  numeric(6,1),                               -- 事務時間（アルバイト用）
  imported_at   timestamptz,                                -- 取込日時
  import_status text NOT NULL DEFAULT '未取込',              -- 未取込/取込済/エラー
  kot_record_id text,                                       -- 重複取込防止用
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, target_month)                        -- 同一従業員・同一年月の重複防止
);

COMMENT ON TABLE root_attendance IS '勤怠データ（キングオブタイム連携）';

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION root_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_root_companies_updated_at
  BEFORE UPDATE ON root_companies
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_bank_accounts_updated_at
  BEFORE UPDATE ON root_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_vendors_updated_at
  BEFORE UPDATE ON root_vendors
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_salary_systems_updated_at
  BEFORE UPDATE ON root_salary_systems
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_employees_updated_at
  BEFORE UPDATE ON root_employees
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_insurance_updated_at
  BEFORE UPDATE ON root_insurance
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

CREATE TRIGGER trg_root_attendance_updated_at
  BEFORE UPDATE ON root_attendance
  FOR EACH ROW EXECUTE FUNCTION root_update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_root_bank_accounts_company ON root_bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_root_vendors_company ON root_vendors(company_id);
CREATE INDEX IF NOT EXISTS idx_root_employees_company ON root_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_root_employees_salary_system ON root_employees(salary_system_id);
CREATE INDEX IF NOT EXISTS idx_root_attendance_employee ON root_attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_root_attendance_month ON root_attendance(target_month);
CREATE INDEX IF NOT EXISTS idx_root_insurance_year ON root_insurance(fiscal_year);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE root_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_salary_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_attendance ENABLE ROW LEVEL SECURITY;

-- 全テーブル共通: 認証済みユーザーは読み書き可能
-- （将来的にロール別に絞る場合はここを変更）
CREATE POLICY "root_companies_all" ON root_companies
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_bank_accounts_all" ON root_bank_accounts
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_vendors_all" ON root_vendors
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_salary_systems_all" ON root_salary_systems
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_employees_all" ON root_employees
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_insurance_all" ON root_insurance
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "root_attendance_all" ON root_attendance
  FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
