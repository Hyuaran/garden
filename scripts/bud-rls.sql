-- ============================================================
-- Garden Bud — RLS ポリシー + 権限判定ヘルパー関数
-- ============================================================
-- 作成: 2026-04-22
--
-- 目的:
--   Bud 固有テーブル（bud_*）のアクセス制御を設定する。
--   Root の `current_garden_role()` ヘルパーを再利用し、
--   Bud 固有の二段階権限（garden_role 自動許可 + bud_users 明示登録）を実装。
--
-- 依存:
--   scripts/root-auth-schema.sql（current_garden_role / root_is_super_admin）
--   scripts/bud-schema.sql が先に適用されていること
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

-- ============================================================
-- 1. 権限判定ヘルパー関数
-- ============================================================

-- Bud へアクセスできるか（admin/super_admin 自動 OR bud_users 明示登録）
CREATE OR REPLACE FUNCTION bud_has_access()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM root_employees e
    LEFT JOIN bud_users b
      ON b.employee_id = e.employee_id
     AND b.is_active = true
    WHERE e.user_id = auth.uid()
      AND e.is_active = true
      AND (
        e.garden_role IN ('admin', 'super_admin')
        OR b.bud_role IS NOT NULL
      )
  );
$$;

-- Bud で approver 以上か（承認・更新操作用）
CREATE OR REPLACE FUNCTION bud_is_approver_or_above()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM root_employees e
    LEFT JOIN bud_users b
      ON b.employee_id = e.employee_id
     AND b.is_active = true
    WHERE e.user_id = auth.uid()
      AND e.is_active = true
      AND (
        e.garden_role IN ('admin', 'super_admin')
        OR b.bud_role IN ('admin', 'approver')
      )
  );
$$;

-- Bud で admin か（bud_users 管理・強制操作用）
CREATE OR REPLACE FUNCTION bud_is_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM root_employees e
    LEFT JOIN bud_users b
      ON b.employee_id = e.employee_id
     AND b.is_active = true
    WHERE e.user_id = auth.uid()
      AND e.is_active = true
      AND (
        e.garden_role IN ('admin', 'super_admin')
        OR b.bud_role = 'admin'
      )
  );
$$;

COMMENT ON FUNCTION bud_has_access IS 'Bud モジュールへアクセスできる権限か';
COMMENT ON FUNCTION bud_is_approver_or_above IS 'Bud で approver 以上か（承認・更新操作用）';
COMMENT ON FUNCTION bud_is_admin IS 'Bud で admin 相当か（bud_users 管理・強制操作用）';

-- ============================================================
-- 2. bud_users ポリシー
-- ============================================================
-- SELECT: Bud アクセス者全員（名前表示等のため）
-- INSERT/UPDATE/DELETE: Garden admin/super_admin のみ（bud_role の変更権限管理）
DROP POLICY IF EXISTS "bud_users_select_all"    ON bud_users;
DROP POLICY IF EXISTS "bud_users_insert_admin"  ON bud_users;
DROP POLICY IF EXISTS "bud_users_update_admin"  ON bud_users;
DROP POLICY IF EXISTS "bud_users_delete_admin"  ON bud_users;

CREATE POLICY "bud_users_select_all" ON bud_users
  FOR SELECT USING (bud_has_access());

CREATE POLICY "bud_users_insert_admin" ON bud_users
  FOR INSERT WITH CHECK (root_can_write());

CREATE POLICY "bud_users_update_admin" ON bud_users
  FOR UPDATE USING (root_can_write()) WITH CHECK (root_can_write());

CREATE POLICY "bud_users_delete_admin" ON bud_users
  FOR DELETE USING (root_can_write());

-- ============================================================
-- 3. bud_transfers ポリシー
-- ============================================================
-- SELECT/INSERT: Bud アクセス者（起票は staff でも可）
-- UPDATE/DELETE: approver 以上（承認・差戻し・確定等）
DROP POLICY IF EXISTS "bud_transfers_select_all"      ON bud_transfers;
DROP POLICY IF EXISTS "bud_transfers_insert_staff"    ON bud_transfers;
DROP POLICY IF EXISTS "bud_transfers_update_approver" ON bud_transfers;
DROP POLICY IF EXISTS "bud_transfers_delete_approver" ON bud_transfers;

CREATE POLICY "bud_transfers_select_all" ON bud_transfers
  FOR SELECT USING (bud_has_access());

CREATE POLICY "bud_transfers_insert_staff" ON bud_transfers
  FOR INSERT WITH CHECK (bud_has_access());

CREATE POLICY "bud_transfers_update_approver" ON bud_transfers
  FOR UPDATE USING (bud_is_approver_or_above())
               WITH CHECK (bud_is_approver_or_above());

CREATE POLICY "bud_transfers_delete_approver" ON bud_transfers
  FOR DELETE USING (bud_is_approver_or_above());

-- ============================================================
-- 4. bud_statements ポリシー
-- ============================================================
-- SELECT/INSERT: Bud アクセス者（CSV取込時 staff でもOK）
-- UPDATE: approver 以上（照合確定用）
DROP POLICY IF EXISTS "bud_statements_select_all"      ON bud_statements;
DROP POLICY IF EXISTS "bud_statements_insert_staff"    ON bud_statements;
DROP POLICY IF EXISTS "bud_statements_update_approver" ON bud_statements;

CREATE POLICY "bud_statements_select_all" ON bud_statements
  FOR SELECT USING (bud_has_access());

CREATE POLICY "bud_statements_insert_staff" ON bud_statements
  FOR INSERT WITH CHECK (bud_has_access());

CREATE POLICY "bud_statements_update_approver" ON bud_statements
  FOR UPDATE USING (bud_is_approver_or_above())
               WITH CHECK (bud_is_approver_or_above());

-- ============================================================
-- 5. bud_salary_batches ポリシー
-- ============================================================
-- SELECT: Bud アクセス者
-- INSERT/UPDATE: approver 以上（給与処理開始権限）
DROP POLICY IF EXISTS "bud_salary_batches_select_all"      ON bud_salary_batches;
DROP POLICY IF EXISTS "bud_salary_batches_insert_approver" ON bud_salary_batches;
DROP POLICY IF EXISTS "bud_salary_batches_update_approver" ON bud_salary_batches;

CREATE POLICY "bud_salary_batches_select_all" ON bud_salary_batches
  FOR SELECT USING (bud_has_access());

CREATE POLICY "bud_salary_batches_insert_approver" ON bud_salary_batches
  FOR INSERT WITH CHECK (bud_is_approver_or_above());

CREATE POLICY "bud_salary_batches_update_approver" ON bud_salary_batches
  FOR UPDATE USING (bud_is_approver_or_above())
               WITH CHECK (bud_is_approver_or_above());

-- ============================================================
-- 6. bud_salary_details ポリシー
-- ============================================================
-- SELECT: Bud アクセス者
-- INSERT/UPDATE: approver 以上
DROP POLICY IF EXISTS "bud_salary_details_select_all"      ON bud_salary_details;
DROP POLICY IF EXISTS "bud_salary_details_insert_approver" ON bud_salary_details;
DROP POLICY IF EXISTS "bud_salary_details_update_approver" ON bud_salary_details;

CREATE POLICY "bud_salary_details_select_all" ON bud_salary_details
  FOR SELECT USING (bud_has_access());

CREATE POLICY "bud_salary_details_insert_approver" ON bud_salary_details
  FOR INSERT WITH CHECK (bud_is_approver_or_above());

CREATE POLICY "bud_salary_details_update_approver" ON bud_salary_details
  FOR UPDATE USING (bud_is_approver_or_above())
               WITH CHECK (bud_is_approver_or_above());

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT proname FROM pg_proc
--   WHERE proname IN ('bud_has_access', 'bud_is_approver_or_above', 'bud_is_admin');
-- （期待: 3行）
--
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename LIKE 'bud_%'
--   ORDER BY tablename, policyname;
-- （期待: bud_users=4 / bud_transfers=4 / bud_statements=3 / bud_salary_batches=3 / bud_salary_details=3 ＝計17ポリシー）
