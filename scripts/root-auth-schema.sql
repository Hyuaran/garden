-- ============================================================
-- Garden Root — 認証拡張スキーマ（root_employees + 監査ログ）
-- ============================================================
-- 作成: 2026-04-21
--
-- 目的:
--   root_employees に Supabase Auth 連携カラム（user_id）と
--   Garden全体ロール（garden_role, 7段階）・誕生日を追加する。
--   加えて監査ログ用 root_audit_log テーブルと
--   権限チェック用ヘルパー関数を作成する。
--
-- 依存:
--   scripts/root-schema.sql（7マスタテーブル）が先に適用されていること
--
-- 冪等性:
--   IF NOT EXISTS / DROP + CREATE などで何度実行しても同じ結果になる。
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
--
-- 関連ドキュメント:
--   docs/superpowers/specs/2026-04-21-tree-supabase-integration-design.md
--   MEMORY: project_garden_auth_policy.md / project_garden_account_flow.md
-- ============================================================

-- ============================================================
-- 1. root_employees に認証拡張カラム追加
-- ============================================================

-- user_id: auth.users への FK（Supabase Auth アカウントとの紐付け）
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS user_id uuid
    UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- garden_role: Garden全体ロール（7段階）
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS garden_role text;

-- 既存のCHECK制約があれば削除（旧5値版 → 新7値版 への置換対応）
ALTER TABLE root_employees
  DROP CONSTRAINT IF EXISTS root_employees_garden_role_check;

-- 新7値CHECK制約を追加
ALTER TABLE root_employees
  ADD CONSTRAINT root_employees_garden_role_check
  CHECK (garden_role IN (
    'toss',         -- トス（アポインター）
    'closer',       -- クローザー
    'cs',           -- CS（仮）: 前確/後確閲覧可の最下位
    'staff',        -- 一般社員（仮）
    'manager',      -- 責任者（仮）
    'admin',        -- 管理者（仮）
    'super_admin'   -- 全権管理者
  ));

-- デフォルト値: 新規アカウントは一律 toss から開始
ALTER TABLE root_employees
  ALTER COLUMN garden_role SET DEFAULT 'toss';

-- 既存レコードで garden_role が NULL のものを 'toss' に初期化
UPDATE root_employees SET garden_role = 'toss' WHERE garden_role IS NULL;

-- NOT NULL 制約を追加
ALTER TABLE root_employees
  ALTER COLUMN garden_role SET NOT NULL;

-- birthday: 誕生日（本人がTree初回ログイン時に入力）
ALTER TABLE root_employees
  ADD COLUMN IF NOT EXISTS birthday date;

-- 備考コメント
COMMENT ON COLUMN root_employees.user_id
  IS 'Supabase Auth ユーザーとの紐付け。NULL=未連携（KoT取込直後など）';
COMMENT ON COLUMN root_employees.garden_role
  IS 'Garden全体ロール。7段階: toss/closer/cs/staff/manager/admin/super_admin';
COMMENT ON COLUMN root_employees.birthday
  IS '誕生日。初期パスワード(MMDD)の生成元。本人がTree初回ログイン時に入力';

-- ============================================================
-- 2. root_audit_log 監査ログテーブル
-- ============================================================
-- 誰が / いつ / 何を した、を記録する。ログイン・権限変更・データ閲覧等。

CREATE TABLE IF NOT EXISTS root_audit_log (
  audit_id       bigserial PRIMARY KEY,
  actor_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_emp_num  text,                                  -- 操作者の社員番号
  action         text NOT NULL,                         -- login_success / login_failed / role_changed / data_view 等
  target_type    text,                                  -- 操作対象の種別（root_employees 等）
  target_id      text,                                  -- 操作対象のID（employee_id 等）
  payload        jsonb,                                 -- 詳細データ（変更前後の値など）
  ip_address     text,
  user_agent     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_root_audit_log_actor_user
  ON root_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_root_audit_log_action
  ON root_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_root_audit_log_created_at
  ON root_audit_log(created_at DESC);

COMMENT ON TABLE root_audit_log IS 'Garden-Root 監査ログ。全セッション間で共有';

-- ============================================================
-- 3. 権限判定ヘルパー関数
-- ============================================================
-- SECURITY DEFINER: 呼び出したユーザーの権限ではなく定義者権限で実行
-- → RLS ポリシー内から呼んでも再帰ループしない

-- 現在ログイン中のユーザーの garden_role を取得
CREATE OR REPLACE FUNCTION current_garden_role()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT garden_role FROM root_employees
    WHERE user_id = auth.uid() AND is_active = true
    LIMIT 1;
$$;

-- Root 画面閲覧可（manager 以上）
-- ⚠️ Phase B-5 (2026-05-13) で has_role_at_least('manager') の wrapper に置換済。
--    本ファイルの定義は歴史的原本として残置。実行時の正本は
--    supabase/migrations/20260513000001_root_can_helpers_to_has_role_at_least.sql。
CREATE OR REPLACE FUNCTION root_can_access()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT current_garden_role() IN ('manager', 'admin', 'super_admin');
$$;

-- Root データ編集可（admin 以上）
-- ⚠️ Phase B-5 (2026-05-13) で has_role_at_least('admin') の wrapper に置換済。
--    本ファイルの定義は歴史的原本として残置。実行時の正本は
--    supabase/migrations/20260513000001_root_can_helpers_to_has_role_at_least.sql。
CREATE OR REPLACE FUNCTION root_can_write()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT current_garden_role() IN ('admin', 'super_admin');
$$;

-- 全権管理者か（garden_role 変更・super_admin 専用操作用）
-- ⚠️ Phase B-5 (2026-05-13) で has_role_at_least('super_admin') の wrapper に置換済。
--    本ファイルの定義は歴史的原本として残置。実行時の正本は
--    supabase/migrations/20260513000001_root_can_helpers_to_has_role_at_least.sql。
CREATE OR REPLACE FUNCTION root_is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT current_garden_role() = 'super_admin';
$$;

-- Tree 前確/後確画面の閲覧可（cs 以上）
CREATE OR REPLACE FUNCTION tree_can_view_confirm()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT current_garden_role() IN (
    'cs', 'staff', 'manager', 'admin', 'super_admin'
  );
$$;

COMMENT ON FUNCTION current_garden_role IS '現ログインユーザーの garden_role を返す。未ログイン/未登録なら NULL';
COMMENT ON FUNCTION root_can_access IS 'Root マスタ画面を閲覧できる権限か（manager 以上）';
COMMENT ON FUNCTION root_can_write IS 'Root マスタを編集できる権限か（admin 以上）';
COMMENT ON FUNCTION root_is_super_admin IS '全権管理者か（garden_role 変更可否の判定に使用）';
COMMENT ON FUNCTION tree_can_view_confirm IS 'Tree 前確/後確画面を閲覧できる権限か（cs 以上）';

-- ============================================================
-- 4. 確認クエリ（手動実行用）
-- ============================================================
-- 以下をSQL Editor で追加実行して適用確認すること：
--
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'root_employees'
--     AND column_name IN ('user_id', 'garden_role', 'birthday');
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'root_employees_garden_role_check';
--
-- SELECT proname FROM pg_proc
--   WHERE proname IN (
--     'current_garden_role', 'root_can_access', 'root_can_write',
--     'root_is_super_admin', 'tree_can_view_confirm'
--   );
