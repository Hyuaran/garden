-- ============================================================
-- Garden Forest — Schema Patch 002
-- Phase A2/A3 進行期編集モーダルのための RLS ポリシー追加
--
-- 追加内容:
--   1. shinkouki UPDATE: admin のみ可
--   2. fiscal_periods INSERT: admin のみ可（期切り替え時）
--   3. audit_log に update_shinkouki / upload_pdf / period_rollover を許可
--
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- shinkouki UPDATE を admin のみに許可
CREATE POLICY "forest_update_shinkouki_admin" ON shinkouki
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

-- fiscal_periods INSERT を admin のみに許可（期切り替え用）
CREATE POLICY "forest_insert_fiscal_periods_admin" ON fiscal_periods
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

-- forest_audit_log の action に新アクションを許可
-- （既存ポリシーが action 列の値を制限していない場合は追加不要だが、
--  明示的な許可リストを置く場合は下記を追加）
-- 既存 forest_audit_insert ポリシーを維持する前提のため、ここでは追加操作なし
