-- ============================================================
-- Garden Root — Phase 1 RLS ポリシー更新
-- ============================================================
-- 目的:
--   7 マスタテーブルに対して garden_role ベースの RLS を適用し、
--   開発用の「全員全許可」ポリシーを置き換える。
--
-- 前提:
--   scripts/root-auth-schema.sql が適用済みであること
--   (root_can_access / root_can_write / root_is_super_admin が存在)
--
-- 冪等性: DROP POLICY IF EXISTS + CREATE POLICY で何度実行してもよい
-- ============================================================

-- ------------------------------------------------------------
-- root_companies
-- ------------------------------------------------------------
ALTER TABLE root_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_companies_all ON root_companies;
DROP POLICY IF EXISTS root_companies_select ON root_companies;
DROP POLICY IF EXISTS root_companies_write ON root_companies;

-- 閲覧: manager 以上
CREATE POLICY root_companies_select ON root_companies
  FOR SELECT
  USING (root_can_access());

-- 書込 (INSERT/UPDATE/DELETE): admin 以上
CREATE POLICY root_companies_write ON root_companies
  FOR ALL
  USING (root_can_write())
  WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_bank_accounts
-- ------------------------------------------------------------
ALTER TABLE root_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_bank_accounts_all ON root_bank_accounts;
DROP POLICY IF EXISTS root_bank_accounts_select ON root_bank_accounts;
DROP POLICY IF EXISTS root_bank_accounts_write ON root_bank_accounts;

CREATE POLICY root_bank_accounts_select ON root_bank_accounts
  FOR SELECT USING (root_can_access());
CREATE POLICY root_bank_accounts_write ON root_bank_accounts
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_vendors
-- ------------------------------------------------------------
ALTER TABLE root_vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_vendors_all ON root_vendors;
DROP POLICY IF EXISTS root_vendors_select ON root_vendors;
DROP POLICY IF EXISTS root_vendors_write ON root_vendors;

CREATE POLICY root_vendors_select ON root_vendors
  FOR SELECT USING (root_can_access());
CREATE POLICY root_vendors_write ON root_vendors
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_employees
-- ------------------------------------------------------------
-- 注意: Tree からの本人参照 (root_employees_select_own) は維持する
-- manager 以上は全員閲覧可、admin 以上は編集可

ALTER TABLE root_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_employees_select_all ON root_employees;
DROP POLICY IF EXISTS root_employees_write ON root_employees;

-- manager 以上は全員参照可 (Tree Phase A で追加済みの root_employees_select_manager と併用)
-- root_employees_select_own は Tree Phase A で作成済み、変更なし

CREATE POLICY root_employees_write ON root_employees
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_salary_systems
-- ------------------------------------------------------------
ALTER TABLE root_salary_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_salary_systems_all ON root_salary_systems;
DROP POLICY IF EXISTS root_salary_systems_select ON root_salary_systems;
DROP POLICY IF EXISTS root_salary_systems_write ON root_salary_systems;

CREATE POLICY root_salary_systems_select ON root_salary_systems
  FOR SELECT USING (root_can_access());
CREATE POLICY root_salary_systems_write ON root_salary_systems
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_insurance
-- ------------------------------------------------------------
ALTER TABLE root_insurance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_insurance_all ON root_insurance;
DROP POLICY IF EXISTS root_insurance_select ON root_insurance;
DROP POLICY IF EXISTS root_insurance_write ON root_insurance;

CREATE POLICY root_insurance_select ON root_insurance
  FOR SELECT USING (root_can_access());
CREATE POLICY root_insurance_write ON root_insurance
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_attendance
-- ------------------------------------------------------------
ALTER TABLE root_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dev_attendance_all ON root_attendance;
DROP POLICY IF EXISTS root_attendance_select ON root_attendance;
DROP POLICY IF EXISTS root_attendance_write ON root_attendance;

CREATE POLICY root_attendance_select ON root_attendance
  FOR SELECT USING (root_can_access());
CREATE POLICY root_attendance_write ON root_attendance
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- 確認クエリ (手動実行推奨)
-- ------------------------------------------------------------
-- SELECT schemaname, tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE tablename LIKE 'root_%'
--   ORDER BY tablename, cmd;
