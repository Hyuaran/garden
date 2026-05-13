-- ============================================================
-- Garden — super_admin 権限固定（東海林さん本人専任）
-- ============================================================
-- 作成日: 2026-05-11
-- 仕様: memory project_super_admin_operation.md
--       docs/specs/plans/2026-05-11-garden-unified-auth-plan.md Task 5
--
-- 設計:
--   1. UI からの super_admin 昇格 / 降格を DB trigger で block
--   2. 唯一の昇格経路 = Supabase Dashboard SQL Editor（service_role）
--   3. service_role 以外の更新は SQLSTATE 42501 で拒否
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
--   1) garden-dev で実行
--   2) trigger 2 件作成確認（下部 確認クエリ参照）
--   3) authenticated session で UPDATE して 42501 確認
--   4) garden-prod に適用
--
-- 依存:
--   scripts/root-auth-schema.sql が先に適用されていること
--   （root_employees.garden_role 列の存在前提）
--
-- 冪等性:
--   CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS で何度実行してもよい
-- ============================================================

-- ------------------------------------------------------------
-- 1. UPDATE 用 trigger function
-- ------------------------------------------------------------
-- super_admin への昇格、または super_admin からの降格を block。
-- service_role セッション（Supabase Dashboard SQL Editor 等）はバイパス。
CREATE OR REPLACE FUNCTION prevent_super_admin_role_change()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE caller_role text := current_setting('role', true);
BEGIN
  -- service_role は唯一の昇格経路。バイパス許可。
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- 昇格 block: 非 super_admin → super_admin
  IF NEW.garden_role = 'super_admin' AND
     (OLD.garden_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'super_admin への昇格はアプリ UI から不可。Supabase Dashboard SQL Editor で東海林さん本人が直接 SQL 実行してください'
      USING ERRCODE = '42501';
  END IF;

  -- 降格 block: super_admin → 非 super_admin
  IF OLD.garden_role = 'super_admin' AND
     (NEW.garden_role IS DISTINCT FROM 'super_admin') THEN
    RAISE EXCEPTION 'super_admin の降格もアプリ UI から不可'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_role_change ON root_employees;
CREATE TRIGGER trg_prevent_super_admin_role_change
  BEFORE UPDATE OF garden_role ON root_employees
  FOR EACH ROW
  WHEN (OLD.garden_role IS DISTINCT FROM NEW.garden_role)
  EXECUTE FUNCTION prevent_super_admin_role_change();

COMMENT ON FUNCTION prevent_super_admin_role_change IS
  'super_admin 昇格/降格を UI からブロック。service_role バイパス。';

-- ------------------------------------------------------------
-- 2. INSERT 用 trigger function
-- ------------------------------------------------------------
-- garden_role='super_admin' を持つ新規 INSERT を block。
-- service_role セッションのみバイパス。
CREATE OR REPLACE FUNCTION prevent_super_admin_insert()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE caller_role text := current_setting('role', true);
BEGIN
  -- service_role は唯一の昇格経路。バイパス許可。
  IF caller_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.garden_role = 'super_admin' THEN
    RAISE EXCEPTION 'super_admin の UI 経由 INSERT は不可'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_insert ON root_employees;
CREATE TRIGGER trg_prevent_super_admin_insert
  BEFORE INSERT ON root_employees
  FOR EACH ROW
  WHEN (NEW.garden_role = 'super_admin')
  EXECUTE FUNCTION prevent_super_admin_insert();

COMMENT ON FUNCTION prevent_super_admin_insert IS
  'super_admin の UI 経由 INSERT をブロック。service_role バイパス。';

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- 以下を SQL Editor で追加実行して適用確認すること：
--
-- -- (1) trigger 2 件が作成されていることを確認
-- SELECT tgname, tgrelid::regclass AS table_name, tgenabled
--   FROM pg_trigger
--   WHERE tgname IN (
--     'trg_prevent_super_admin_role_change',
--     'trg_prevent_super_admin_insert'
--   );
--
-- 期待値: 2 行、tgrelid='root_employees', tgenabled='O'
--
-- -- (2) function 2 件が作成されていることを確認
-- SELECT proname FROM pg_proc
--   WHERE proname IN (
--     'prevent_super_admin_role_change',
--     'prevent_super_admin_insert'
--   );
--
-- 期待値: 2 行
--
-- ============================================================
-- 動作確認クエリ（適用後に必ず実行）
-- ============================================================
-- 以下は authenticated session（SQL Editor で SET ROLE authenticated 後）で実行:
--
-- -- (A) 既存非 super_admin を super_admin に昇格しようとすると 42501
-- UPDATE root_employees
--   SET garden_role = 'super_admin'
--   WHERE employee_number = '0001';  -- 0001 を任意の非 super_admin 社員番号に差し替え
-- -- 期待: ERROR: 42501 super_admin への昇格はアプリ UI から不可...
--
-- -- (B) 既存 super_admin を降格しようとすると 42501
-- UPDATE root_employees
--   SET garden_role = 'admin'
--   WHERE employee_number = '0008';  -- 東海林さん本人
-- -- 期待: ERROR: 42501 super_admin の降格もアプリ UI から不可
--
-- -- (C) INSERT with super_admin も 42501
-- INSERT INTO root_employees (employee_id, employee_number, name, garden_role, ...)
--   VALUES ('EMP-9999', '9999', 'テスト', 'super_admin', ...);
-- -- 期待: ERROR: 42501 super_admin の UI 経由 INSERT は不可
--
-- -- (D) service_role で実行するとバイパス成功
-- RESET ROLE;
-- SET ROLE service_role;
-- UPDATE root_employees
--   SET garden_role = 'super_admin'
--   WHERE employee_number = '0008';  -- 既に super_admin なら no-op、確認用
-- -- 期待: UPDATE 成功（service_role バイパス）
-- RESET ROLE;
-- ============================================================
