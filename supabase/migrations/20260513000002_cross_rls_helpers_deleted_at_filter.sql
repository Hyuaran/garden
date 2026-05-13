-- ============================================================
-- Garden — Cross-RLS Helpers: deleted_at filter 強化 (P1)
-- ============================================================
-- 対応 dispatch: 2026-05-13 main- No. 343 §C
-- 関連 PR: #154 (supabase/migrations/20260511000001_cross_rls_helpers.sql)
-- 関連 spec: docs/specs/2026-04-25-root-phase-b-03-termination-rules.md
-- 関連 dispatch: bud-002 No. 56 副次影響
--
-- 目的:
--   退職者 (root_employees.deleted_at IS NOT NULL) が RLS を通過してしまう
--   既存挙動を防止するため、RLS helper 関数 3 本に
--   `deleted_at IS NULL` filter を追加する。
--
-- 既存仕様（PR #154 + scripts/root-auth-schema.sql）:
--   - auth_employee_number(): WHERE user_id=auth.uid() AND is_active=true のみ
--   - current_garden_role(): 同上
--   - has_role_at_least(): 内部で current_garden_role() を呼出（間接連動）
--
-- 強化後（本 migration）:
--   - auth_employee_number(): + AND deleted_at IS NULL
--   - current_garden_role(): + AND deleted_at IS NULL
--   - has_role_at_least(): 内部 current_garden_role() 経由で連動更新
--                          （wrapper 自体の SQL 変更なし）
--
-- 影響範囲:
--   - 既存 active ユーザー (is_active=true AND deleted_at IS NULL): 影響なし
--   - 退職者 (deleted_at IS NOT NULL):
--       auth_employee_number() = NULL に変化
--       current_garden_role() = NULL に変化
--       has_role_at_least(*) = false に変化
--   - is_active=false かつ deleted_at=null（休職等）: 従来通り NULL/false
--
-- 関連既存 helper との関係:
--   root_can_access(), root_can_write(), root_is_super_admin(),
--   tree_can_view_confirm() はいずれも current_garden_role() を内部で呼ぶため、
--   本 migration により自動的に deleted_at filter が適用される。
--
-- 冪等性:
--   CREATE OR REPLACE FUNCTION で何度実行しても同じ結果になる。
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   先に scripts/root-auth-schema.sql および
--   supabase/migrations/20260511000001_cross_rls_helpers.sql の
--   適用が完了していること（既存運用 garden-dev / garden-prod 適用済前提）。
-- ============================================================

-- ------------------------------------------------------------
-- 関数 1: current_garden_role() — deleted_at filter 追加
-- ------------------------------------------------------------
-- 既存定義: scripts/root-auth-schema.sql L113-122
-- 既存挙動: WHERE user_id = auth.uid() AND is_active = true
-- 変更点  : + AND deleted_at IS NULL
-- 戻り値型: text（変更なし）
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_garden_role()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT garden_role FROM root_employees
    WHERE user_id = auth.uid()
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
$$;

COMMENT ON FUNCTION current_garden_role IS
  '現ログインユーザーの garden_role を返す。未ログイン/未登録/退職者 (deleted_at not null) なら NULL（dispatch main- No. 343 §C deleted_at filter 強化）';

-- ------------------------------------------------------------
-- 関数 2: auth_employee_number() — deleted_at filter 追加
-- ------------------------------------------------------------
-- 既存定義: supabase/migrations/20260511000001_cross_rls_helpers.sql L41-51
-- 既存挙動: WHERE user_id = auth.uid() AND is_active = true
-- 変更点  : + AND deleted_at IS NULL
-- 戻り値型: text（変更なし）
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION auth_employee_number()
  RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  SELECT employee_number FROM root_employees
    WHERE user_id = auth.uid()
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
$$;

COMMENT ON FUNCTION auth_employee_number IS
  '現在ログイン中ユーザーの employee_number を取得。RLS ポリシーで自分担当判定に使用。退職者 (deleted_at not null) には NULL を返す（dispatch main- No. 343 §C deleted_at filter 強化）';

-- ------------------------------------------------------------
-- 関数 3: has_role_at_least(role_min text) — 連動更新（SQL 変更なし）
-- ------------------------------------------------------------
-- 既存定義: supabase/migrations/20260511000001_cross_rls_helpers.sql L77-111
-- 内部実装: current_garden_role() を呼ぶため、上記 #1 の更新により
--          退職者に対しては自動的に false を返すようになる。
-- 本 migration では wrapper 自体の SQL 変更は不要だが、
-- COMMENT を更新して挙動変化を明示する。
-- ------------------------------------------------------------

COMMENT ON FUNCTION has_role_at_least IS
  '現在ログイン中ユーザーの garden_role が指定 role_min 以上か判定。8 段階階層 toss<closer<cs<staff<outsource<manager<admin<super_admin。退職者 (deleted_at not null) は内部 current_garden_role() 経由で false を返す（dispatch main- No. 343 §C deleted_at filter 強化により連動）';

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- 適用直後の関数定義確認:
-- SELECT proname, prosrc FROM pg_proc
--   WHERE proname IN (
--     'auth_employee_number', 'current_garden_role', 'has_role_at_least'
--   );
-- 期待: 3 件、prosrc に 'deleted_at IS NULL' が含まれる（#1, #2）
--
-- 退職者擬似テスト（garden-dev での確認手順）:
-- 1. テスト用 employee を 1 件用意（is_active=true, deleted_at=null）
-- 2. その employee の auth.uid() でログインし以下を実行:
--      SELECT auth_employee_number();   -- 期待: employee_number が返る
--      SELECT current_garden_role();    -- 期待: garden_role が返る
--      SELECT has_role_at_least('staff'); -- 期待: 設定 role に応じて true/false
-- 3. UPDATE root_employees SET deleted_at = now() WHERE user_id = '<test_uuid>';
-- 4. 同一セッションで再度上記 3 関数を実行:
--      SELECT auth_employee_number();   -- 期待: NULL
--      SELECT current_garden_role();    -- 期待: NULL
--      SELECT has_role_at_least('staff'); -- 期待: false
-- 5. テスト後 UPDATE root_employees SET deleted_at = null WHERE user_id = '<test_uuid>'; で復旧

-- ------------------------------------------------------------
-- 副次影響メモ（bud-002 No. 56 関連）
-- ------------------------------------------------------------
-- 本 migration により、退職者の RLS 通過が全モジュール（Root / Bud / Tree /
-- Leaf / Forest / Bloom 等）で同時に修正される。各モジュールの RLS ポリシーは
-- 既に current_garden_role() / auth_employee_number() を経由しているため、
-- ポリシー側の修正は不要。
--
-- 既知の例外:
--   docs/specs/2026-04-25-root-phase-b-03-termination-rules.md §3.2 で言及される
--   is_user_active() は別 helper で deleted_at filter を独立に持つため、
--   本 migration の対象外。is_user_active() の修正は同 spec の実装 PR で対応。
