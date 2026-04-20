-- ============================================================
-- Garden Root — 認証・権限拡張スキーマ
-- 実行順序: root-schema.sql の後に実行
-- ============================================================

-- ============================================================
-- 1. root_employees 拡張
-- ============================================================

-- user_id: auth.users への FK（Supabase Auth 連携）
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- garden_role: Garden全体の権限レベル（5段階）
-- トス/クローザー/責任者/管理者/全権管理者
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS garden_role text NOT NULL DEFAULT 'toss'
    CHECK (garden_role IN ('toss', 'closer', 'manager', 'admin', 'super_admin'));

-- birthday: 誕生日（一般社員の初期パスワード生成元）
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS birthday date;

COMMENT ON COLUMN root_employees.user_id IS 'Supabase Auth ユーザー ID';
COMMENT ON COLUMN root_employees.garden_role IS 'Garden権限: toss/closer/manager/admin/super_admin';
COMMENT ON COLUMN root_employees.birthday IS '誕生日（初期パスワードMMDD生成元）';

CREATE INDEX IF NOT EXISTS idx_root_employees_user_id ON root_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_root_employees_garden_role ON root_employees(garden_role);

-- ============================================================
-- 2. root_audit_log 作成（監査ログ）
-- ============================================================

CREATE TABLE IF NOT EXISTS root_audit_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id),
  action      text NOT NULL,   -- 'login', 'logout_manual', 'logout_timeout',
                                -- 'view_companies', 'update_employee', 'update_role' 等
  target      text,             -- 対象レコードID（employee_id など）
  ip_address  text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE root_audit_log IS 'Rootモジュールの監査ログ';

CREATE INDEX IF NOT EXISTS idx_root_audit_log_user ON root_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_root_audit_log_created ON root_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_root_audit_log_action ON root_audit_log(action);

-- ============================================================
-- 3. 権限チェック用 ヘルパー関数
-- ============================================================

-- 現在のユーザーが Root にアクセスできるか（責任者以上）
CREATE OR REPLACE FUNCTION root_can_access()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM root_employees
    WHERE user_id = auth.uid()
      AND garden_role IN ('manager', 'admin', 'super_admin')
      AND is_active = true
  );
$$;

-- 現在のユーザーが Root で書き込み可能か（管理者以上）
CREATE OR REPLACE FUNCTION root_can_write()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM root_employees
    WHERE user_id = auth.uid()
      AND garden_role IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

-- 現在のユーザーが全権管理者か（garden_role 変更権限）
CREATE OR REPLACE FUNCTION root_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM root_employees
    WHERE user_id = auth.uid()
      AND garden_role = 'super_admin'
      AND is_active = true
  );
$$;

COMMENT ON FUNCTION root_can_access() IS 'Rootアクセス可否（責任者以上）';
COMMENT ON FUNCTION root_can_write() IS 'Root書き込み可否（管理者以上）';
COMMENT ON FUNCTION root_is_super_admin() IS '全権管理者かどうか';

-- ============================================================
-- 4. root_audit_log の RLS
-- ============================================================

ALTER TABLE root_audit_log ENABLE ROW LEVEL SECURITY;

-- ログインユーザーは自分の操作を insert 可能
CREATE POLICY "root_audit_insert" ON root_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 全権管理者のみ全件 SELECT 可能
CREATE POLICY "root_audit_select_super_admin" ON root_audit_log
  FOR SELECT USING (root_is_super_admin());
