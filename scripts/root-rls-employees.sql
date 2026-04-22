-- ============================================================
-- Garden Root — root_employees RLSポリシー
-- ============================================================
-- 作成: 2026-04-21
--
-- 目的:
--   root_employees テーブルに対して以下のアクセス制御を適用する：
--     - 誰でも自分の行だけは SELECT 可能（マイページ表示用）
--     - manager 以上は全員の行を SELECT 可能（ランキング・監督用途）
--     - admin 以上のみ INSERT / UPDATE 可能
--     - garden_role の変更は super_admin のみ（トリガで enforce）
--
-- 依存:
--   scripts/root-auth-schema.sql が先に適用されていること
--   （ヘルパー関数 root_can_access / root_can_write / root_is_super_admin が必要）
--
-- 適用方法:
--   Supabase Dashboard → SQL Editor → 本ファイルの内容を貼り付けて Run
-- ============================================================

-- RLS を有効化
ALTER TABLE root_employees ENABLE ROW LEVEL SECURITY;

-- 既存ポリシー（もしあれば）削除 — 冪等にするため
DROP POLICY IF EXISTS "root_employees_select_own"       ON root_employees;
DROP POLICY IF EXISTS "root_employees_select_manager"   ON root_employees;
DROP POLICY IF EXISTS "root_employees_update_admin"     ON root_employees;
DROP POLICY IF EXISTS "root_employees_insert_admin"     ON root_employees;

-- ============================================================
-- ポリシー① 誰でも自分の行は SELECT 可能
-- ============================================================
-- マイページの閲覧用。toss/closer/cs/staff でも自分の行は見える。
CREATE POLICY "root_employees_select_own" ON root_employees
  FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- ポリシー② manager 以上は全員の行を SELECT 可能
-- ============================================================
-- ランキング・モニタリング・監督用途。
CREATE POLICY "root_employees_select_manager" ON root_employees
  FOR SELECT
  USING (root_can_access());

-- ============================================================
-- ポリシー③ admin 以上のみ UPDATE 可能
-- ============================================================
-- 一般的なデータ更新。garden_role の変更は別途トリガで super_admin に制限。
CREATE POLICY "root_employees_update_admin" ON root_employees
  FOR UPDATE
  USING (root_can_write())
  WITH CHECK (root_can_write());

-- ============================================================
-- ポリシー④ admin 以上のみ INSERT 可能
-- ============================================================
-- 新規従業員登録（Tree の「＋新しいアカウントを追加」から）。
-- staff以上で使えるUIはアプリ側で、DB上は admin 以上のみ許可。
-- ※ Phase B 以降、staff以上でも登録できるようポリシーを拡張する可能性あり
CREATE POLICY "root_employees_insert_admin" ON root_employees
  FOR INSERT
  WITH CHECK (root_can_write());

-- ============================================================
-- garden_role 変更制限トリガー
-- ============================================================
-- super_admin 以外が garden_role を変更しようとしたら例外を投げる。
-- これは RLS ポリシーでは表現できない（UPDATE 全体を禁止するわけではないため）。

CREATE OR REPLACE FUNCTION enforce_garden_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- garden_role が変化したときのみチェック
  IF NEW.garden_role IS DISTINCT FROM OLD.garden_role THEN
    IF NOT root_is_super_admin() THEN
      RAISE EXCEPTION
        'garden_role の変更は全権管理者(super_admin)のみ可能です。現在の権限: %',
        COALESCE(current_garden_role(), '(未認証)')
        USING HINT = '操作者の garden_role を確認してください';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_garden_role_change
  IS 'root_employees.garden_role の変更は super_admin のみ許可する制約トリガー';

-- 既存トリガ削除 + 新規作成
DROP TRIGGER IF EXISTS tr_root_employees_role_change ON root_employees;
CREATE TRIGGER tr_root_employees_role_change
  BEFORE UPDATE ON root_employees
  FOR EACH ROW
  EXECUTE FUNCTION enforce_garden_role_change();

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
--
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'root_employees'
--   ORDER BY policyname;
-- （期待: 4ポリシー: select_own / select_manager / update_admin / insert_admin）
--
-- SELECT tgname FROM pg_trigger
--   WHERE tgname = 'tr_root_employees_role_change';
-- （期待: 1行）
