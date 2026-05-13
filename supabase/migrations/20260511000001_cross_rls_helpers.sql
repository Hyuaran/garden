-- ============================================================
-- Garden — Cross-cutting RLS Helper Functions
-- ============================================================
-- 対応 dispatch: 2026-05-11(月) 11:25 a-main-020 main- No. 233
-- 確定 Q1/Q2/Q3 反映:
--   Q1 候補 A: 命名規則 global 名空間（auth_/has_/is_ prefix）採用
--   Q2 (b) 縮退: is_same_department は本 migration から除外、
--               Tree D-01 §4.1 は「自分担当 only」縮退で対応（別 spec 改訂）
--   Q3 統一: 既存 root_can_access / root_can_write 等は維持しつつ、
--           cross-cutting には has_role_at_least を採用
--
-- 関連:
--   - spec-cross-rls-audit.md §6.1 命名規則統一（本 migration と同 PR で改訂）
--   - spec-tree-phase-d-01-schema-migration.md §4 RLS ポリシー使用
--   - root-auth-schema.sql §3 既存 helper (current_garden_role 等) を再利用
--   - Phase A-3-g で garden_role が 8 段階に拡張済（outsource 追加）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   先に scripts/root-auth-schema.sql の current_garden_role() が
--   適用済であること（既存運用 garden-dev / garden-prod とも適用済前提）。
--
-- 冪等性:
--   CREATE OR REPLACE FUNCTION で何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- 関数 1: auth_employee_number()
-- ------------------------------------------------------------
-- 機能: 現在ログイン中の auth.uid() から root_employees.employee_number を取得
-- 用途:
--   RLS ポリシーで「自分のレコードのみ」「自分担当のみ」を判定する際に使用
--   例: USING (employee_id = auth_employee_number())
-- 設計:
--   - SECURITY DEFINER: 呼出ユーザー権限ではなく定義者権限で実行
--     （RLS 内部から呼んでも再帰ループしない）
--   - STABLE: 同一 transaction 内では同じ結果を返す（query planner 最適化）
--   - 未認証 / root_employees 未紐付 / 退職者の場合は NULL を返す
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
    LIMIT 1;
$$;

COMMENT ON FUNCTION auth_employee_number IS
  '現在ログイン中ユーザーの employee_number を取得。RLS ポリシーで自分担当判定に使用（dispatch main- No. 233 Q1 候補 A 確定）';

-- ------------------------------------------------------------
-- 関数 2: has_role_at_least(role_min text)
-- ------------------------------------------------------------
-- 機能: 現在ログイン中ユーザーの garden_role が指定 role_min 以上か判定
-- 用途:
--   RLS ポリシーで階層的な権限判定に使用
--   例: USING (has_role_at_least('manager'))
-- ロール階層（Phase A-3-g 反映後の 8 段階）:
--   toss < closer < cs < staff < outsource < manager < admin < super_admin
-- 設計:
--   - 既存 current_garden_role() を内部で使用
--   - SECURITY DEFINER + STABLE で RLS 内部から安全に呼出可
--   - 未認証 / 未紐付 / 退職者は false を返す
--   - role_min が不正値の場合は false を返す（防御的）
-- 関連既存 helper との関係:
--   root_can_access()     ≈ has_role_at_least('manager')
--   root_can_write()      ≈ has_role_at_least('admin')
--   root_is_super_admin() ≈ has_role_at_least('super_admin')
--   → 既存 helper は維持、段階的置換は別 PR（急務でない）
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION has_role_at_least(role_min text)
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
AS $$
  WITH role_order AS (
    SELECT role_name, idx
    FROM (VALUES
      ('toss',        1),
      ('closer',      2),
      ('cs',          3),
      ('staff',       4),
      ('outsource',   5),
      ('manager',     6),
      ('admin',       7),
      ('super_admin', 8)
    ) AS t(role_name, idx)
  ),
  current_role_rank AS (
    SELECT idx FROM role_order
    WHERE role_name = current_garden_role()
    LIMIT 1
  ),
  min_role_rank AS (
    SELECT idx FROM role_order
    WHERE role_name = role_min
    LIMIT 1
  )
  SELECT
    COALESCE(
      (SELECT idx FROM current_role_rank) >= (SELECT idx FROM min_role_rank),
      false
    );
$$;

COMMENT ON FUNCTION has_role_at_least IS
  '現在ログイン中ユーザーの garden_role が指定 role_min 以上か判定。8 段階階層 toss<closer<cs<staff<outsource<manager<admin<super_admin（dispatch main- No. 233 Q3 統一確定）';

-- ------------------------------------------------------------
-- 関数 3: is_same_department(target_employee_id uuid)
-- ------------------------------------------------------------
-- ⚠️ 本 migration では実装スキップ（dispatch main- No. 233 Q2 (b) 縮退決裁）
--
-- 理由:
--   - root_employees に department 列が現状なし
--   - root_departments マスタテーブルも未作成
--   - Phase B-4 マスタ間整合 spec / B-08 employees 拡張 spec とも未統合
--
-- 縮退対応:
--   - Tree D-01 spec §4.1 で is_same_department() を使用していた箇所は
--     「自分担当 only」（auth.uid() = assigned_employee_id 等）に縮退
--   - 別 dispatch で a-tree-002 に spec 改訂依頼予定
--
-- 将来の実装条件:
--   1. root_employees.department_id 列追加（migration 必要）
--   2. root_departments マスタテーブル新規作成
--   3. department 運用ルール確定（昇進・異動・複数所属の扱い）
--
-- 実装着手時期:
--   Phase B-4 マスタ間整合チェック実装と同時、または Phase C 以降
-- ------------------------------------------------------------

-- （is_same_department 関数定義は本 migration では作成しない）

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- SELECT proname, prosrc FROM pg_proc
--   WHERE proname IN ('auth_employee_number', 'has_role_at_least');
-- 期待: 2 件（is_same_department は含まれない）

-- 機能確認（ログイン後の Authenticated session で実行）:
-- SELECT auth_employee_number();
-- SELECT has_role_at_least('staff');
-- SELECT has_role_at_least('manager');
-- SELECT has_role_at_least('super_admin');

-- ------------------------------------------------------------
-- 命名規則統一の補足
-- ------------------------------------------------------------
-- 本 migration の命名規則（global 名空間 auth_/has_/is_ prefix）は
-- spec-cross-rls-audit.md §6.1 の命名規則改訂と整合させる。
-- 同 spec の改訂は本 migration と同 PR で実施（dispatch main- No. 233 §3-3）。
--
-- 既存 root_can_access() / root_can_write() / root_is_super_admin() /
-- tree_can_view_confirm() は維持（破壊的変更回避）。
-- has_role_at_least() への段階的置換は別 PR で実施想定（急務でない）。
