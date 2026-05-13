-- ============================================================
-- Garden-Root Phase B-5 セキュリティ強化
-- root_can_access / root_can_write / root_is_super_admin を
-- has_role_at_least() wrapper に置換（behavior 互換）
-- ============================================================
-- 対応 dispatch: main- No. 343
-- 関連 spec: docs/specs/cross-cutting/2026-05-11-garden-rls-design-guide.md §2.1 / §5 Phase 2
-- 関連 migration:
--   scripts/root-auth-schema.sql                                   (旧定義の原本)
--   supabase/migrations/20260511000001_cross_rls_helpers.sql       (has_role_at_least 定義、PR #154 で apply 済)
--   scripts/root-rls-phase1.sql                                    (これら helper を呼ぶ RLS policy 群)
--
-- 設計:
--   root_can_access()     := has_role_at_least('manager')      -- manager 以上
--   root_can_write()      := has_role_at_least('admin')        -- admin 以上
--   root_is_super_admin() := has_role_at_least('super_admin')  -- super_admin 限定
--
-- behavior 互換性:
--   既存 SQL function 呼出元（RLS policy / アプリケーションコード）は無変更。
--   function 名 + signature + RETURN 型 + LANGUAGE + SECURITY DEFINER + STABLE を
--   全て既存と一致させ、内部 SELECT 式のみを has_role_at_least() 呼出に置換する。
--
-- 等価性の根拠:
--   旧 root_can_access:     current_garden_role() IN ('manager', 'admin', 'super_admin')
--   新 has_role_at_least('manager'): role 階層 (toss<closer<cs<staff<outsource<manager<admin<super_admin)
--                                    のうち manager 以上が true
--   → outsource は manager 未満なので false。他 6 段階の判定は完全一致。
--
--   旧 root_can_write:      current_garden_role() IN ('admin', 'super_admin')
--   新 has_role_at_least('admin'): admin / super_admin のみ true
--   → 完全一致。
--
--   旧 root_is_super_admin: current_garden_role() = 'super_admin'
--   新 has_role_at_least('super_admin'): super_admin のみ true
--   → 完全一致。
--
-- apply 手順 (A-RP-1 物理検証義務):
--   1. garden-dev で Supabase Dashboard > SQL Editor に貼付 Run
--   2. 確認クエリで戻り値が変わらないこと確認
--      SELECT root_can_access();    -- 現セッションが manager 以上か
--      SELECT root_can_write();     -- 現セッションが admin 以上か
--      SELECT root_is_super_admin(); -- 現セッションが super_admin か
--   3. pg_proc で 3 helper の prosrc が has_role_at_least を呼んでいることを目視確認
--   4. RLS 適用済テーブル（root_companies 等）で SELECT / INSERT 試験
--   5. garden-prod へ同様に apply、検証完了後に 3 点併記コメントを本 PR に追加
--
-- 冪等性:
--   CREATE OR REPLACE FUNCTION を使用しているため何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- root_can_access — manager 以上判定 (Phase B-5 wrapper 化)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION root_can_access()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT has_role_at_least('manager');
$$;

COMMENT ON FUNCTION root_can_access IS
  'Root マスタ画面を閲覧できる権限か（manager 以上）。Phase B-5 で has_role_at_least(''manager'') の wrapper 化（dispatch main- No. 343）';

-- ------------------------------------------------------------
-- root_can_write — admin 以上判定 (Phase B-5 wrapper 化)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION root_can_write()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT has_role_at_least('admin');
$$;

COMMENT ON FUNCTION root_can_write IS
  'Root マスタを編集できる権限か（admin 以上）。Phase B-5 で has_role_at_least(''admin'') の wrapper 化（dispatch main- No. 343）';

-- ------------------------------------------------------------
-- root_is_super_admin — super_admin 限定判定 (Phase B-5 wrapper 化)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION root_is_super_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT has_role_at_least('super_admin');
$$;

COMMENT ON FUNCTION root_is_super_admin IS
  '全権管理者か（garden_role 変更可否の判定に使用）。Phase B-5 で has_role_at_least(''super_admin'') の wrapper 化（dispatch main- No. 343）';

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- 1) function 定義の中身確認:
--   SELECT proname, prosrc FROM pg_proc
--     WHERE proname IN ('root_can_access', 'root_can_write', 'root_is_super_admin')
--     ORDER BY proname;
--   期待: 3 件、各 prosrc に "has_role_at_least" を含む
--
-- 2) 戻り値の互換性確認（ログイン済セッションで実行）:
--   SELECT root_can_access();    -- 期待: manager 以上で true
--   SELECT root_can_write();     -- 期待: admin 以上で true
--   SELECT root_is_super_admin(); -- 期待: super_admin で true
--
-- 3) RLS policy 動作確認:
--   SET LOCAL role = '<test-role-jwt>';
--   SELECT count(*) FROM root_companies;   -- root_can_access() ベース
--   INSERT INTO root_vendors (...) VALUES (...);  -- root_can_write() ベース
--   期待: Phase 1 (PR #134) 適用後と完全同一の挙動
--
-- 4) pg_policies に変更がないこと確認:
--   SELECT schemaname, tablename, policyname, cmd
--     FROM pg_policies WHERE tablename LIKE 'root_%' ORDER BY tablename, cmd;
--   期待: Phase 1 適用後と同じ 16 行
-- ============================================================
