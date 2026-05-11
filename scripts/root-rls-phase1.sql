-- ============================================================
-- Garden Root — Phase 1 RLS ポリシー更新
-- ============================================================
-- 目的:
--   7 マスタテーブルに対して garden_role ベースの RLS を適用し、
--   開発用の「全員全許可」ポリシー (*_dev) を置き換える。
--
-- 前提:
--   scripts/root-auth-schema.sql が適用済みであること
--   (root_can_access / root_can_write / root_is_super_admin が存在)
--
-- 方針 (2026-04-22 修正):
--   既存 dev ポリシー名は <tablename>_dev (例: root_companies_dev) で
--   統一されている。このポリシーのみ DROP し、新しい select / write
--   ポリシーを追加する。
--
--   root_employees は Tree Phase A で既に以下の細かいポリシーが適用済:
--     root_employees_select_own     (SELECT) — 本人のみ
--     root_employees_select_manager (SELECT) — manager 以上
--     root_employees_insert_admin   (INSERT) — admin 以上
--     root_employees_update_admin   (UPDATE) — admin 以上
--   これらは Phase 1 要件を満たすため変更不要。_dev のみ削除する。
--
-- 冪等性: DROP POLICY IF EXISTS + CREATE POLICY で何度実行してもよい
-- ============================================================

-- ------------------------------------------------------------
-- root_companies
-- ------------------------------------------------------------
ALTER TABLE root_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_companies_dev ON root_companies;
DROP POLICY IF EXISTS root_companies_select ON root_companies;
DROP POLICY IF EXISTS root_companies_write ON root_companies;

CREATE POLICY root_companies_select ON root_companies
  FOR SELECT
  USING (root_can_access());

CREATE POLICY root_companies_write ON root_companies
  FOR ALL
  USING (root_can_write())
  WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_bank_accounts
-- ------------------------------------------------------------
ALTER TABLE root_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_bank_accounts_dev ON root_bank_accounts;
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

DROP POLICY IF EXISTS root_vendors_dev ON root_vendors;
DROP POLICY IF EXISTS root_vendors_select ON root_vendors;
DROP POLICY IF EXISTS root_vendors_write ON root_vendors;

CREATE POLICY root_vendors_select ON root_vendors
  FOR SELECT USING (root_can_access());
CREATE POLICY root_vendors_write ON root_vendors
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- root_employees — Tree Phase A ポリシーを温存、_dev のみ削除
-- ------------------------------------------------------------
ALTER TABLE root_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_employees_dev ON root_employees;

-- 以下は変更不要 (Tree Phase A で作成済、Phase 1 要件を満たす):
--   root_employees_select_own     (SELECT) — 本人のみ
--   root_employees_select_manager (SELECT) — manager 以上
--   root_employees_insert_admin   (INSERT) — admin 以上
--   root_employees_update_admin   (UPDATE) — admin 以上

-- ------------------------------------------------------------
-- root_salary_systems
-- ------------------------------------------------------------
ALTER TABLE root_salary_systems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_salary_systems_dev ON root_salary_systems;
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

DROP POLICY IF EXISTS root_insurance_dev ON root_insurance;
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

DROP POLICY IF EXISTS root_attendance_dev ON root_attendance;
DROP POLICY IF EXISTS root_attendance_select ON root_attendance;
DROP POLICY IF EXISTS root_attendance_write ON root_attendance;

CREATE POLICY root_attendance_select ON root_attendance
  FOR SELECT USING (root_can_access());
CREATE POLICY root_attendance_write ON root_attendance
  FOR ALL USING (root_can_write()) WITH CHECK (root_can_write());

-- ------------------------------------------------------------
-- 確認クエリ (手動実行推奨)
-- ------------------------------------------------------------
-- SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename LIKE 'root_%'
--   ORDER BY tablename, cmd;
--
-- 期待される結果 (Phase 1 適用後):
--   root_attendance     root_attendance_select      SELECT
--   root_attendance     root_attendance_write       ALL
--   root_bank_accounts  root_bank_accounts_select   SELECT
--   root_bank_accounts  root_bank_accounts_write    ALL
--   root_companies      root_companies_select       SELECT
--   root_companies      root_companies_write        ALL
--   root_employees      root_employees_insert_admin   INSERT
--   root_employees      root_employees_select_manager SELECT
--   root_employees      root_employees_select_own     SELECT
--   root_employees      root_employees_update_admin   UPDATE
--   root_insurance      root_insurance_select       SELECT
--   root_insurance      root_insurance_write        ALL
--   root_salary_systems root_salary_systems_select  SELECT
--   root_salary_systems root_salary_systems_write   ALL
--   root_vendors        root_vendors_select         SELECT
--   root_vendors        root_vendors_write          ALL
-- (合計 16 行)

-- ============================================================
-- 将来計画 (2026-05-11 追加)
-- ============================================================
-- 本ファイルで使用している helper（root_can_access / root_can_write /
-- root_is_super_admin）は、Phase B-5 で PR #154 の has_role_at_least() を
-- 内部呼出する wrapper に置換予定。
--
-- 等価関係:
--   root_can_access()     ≈ has_role_at_least('manager')
--   root_can_write()      ≈ has_role_at_least('admin')
--   root_is_super_admin() ≈ has_role_at_least('super_admin')
--
-- wrapper 化後は本ファイル内の policy は **無修正で動作**（内部実装の置換のみ）。
-- 既存 RLS 動作を破壊しないことを Phase B-5 PR の Acceptance に含める。
--
-- 関連ドキュメント:
--   scripts/garden-rls-unified-template.sql        … 新規追加テーブル雛形（5 pattern）
--   docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md … 設計ガイド全文
--   docs/specs/plans/2026-05-11-garden-unified-auth-plan.md (Task 4 + Phase B-5)
-- ============================================================
