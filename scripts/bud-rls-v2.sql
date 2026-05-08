-- ============================================================
-- Garden Bud — bud_transfers v2 RLS ポリシー
-- ============================================================
-- 作成: 2026-04-23
-- 目的:
--   Phase 1b で 6 段階ステータス遷移を導入するため、既存の粗い
--   bud_transfers_update_approver ポリシーを破棄し、遷移ごとに
--   権限を分割した複数のポリシーで置き換える。
--
-- 権限マッピング:
--   下書き作成・編集      → bud_has_access()
--   確認済みへ            → bud_is_admin() 以上（かつ起票者以外）
--   承認待ちへ            → 起票者本人 or admin 以上
--   承認済みへ            → bud_is_admin() 以上
--   差戻し                → bud_is_admin() 以上
--   super_admin スキップ → root_is_super_admin() AND 自起票
--   CSV 出力済みへ        → root_is_super_admin() のみ
--   振込完了へ            → root_is_super_admin() のみ
--
-- 依存:
--   scripts/bud-schema.sql（Phase 0）
--   scripts/bud-rls.sql（Phase 0）
--   scripts/bud-transfers-v2.sql（Task 0）
-- ============================================================

-- ============================================================
-- 1. 既存の粗い UPDATE ポリシーを削除
-- ============================================================
DROP POLICY IF EXISTS "bud_transfers_update_approver" ON bud_transfers;
DROP POLICY IF EXISTS "bud_transfers_delete_approver" ON bud_transfers;

-- SELECT と INSERT はそのまま維持（bud_has_access() で十分）

-- ============================================================
-- 2. 下書き編集（起票者本人 or admin 以上）
-- ============================================================
CREATE POLICY "bud_transfers_update_draft_self_or_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND (created_by = auth.uid() OR bud_is_admin())
  )
  WITH CHECK (
    status IN ('下書き', '確認済み')
    AND (created_by = auth.uid() OR bud_is_admin())
  );

-- ============================================================
-- 3. 確認済み → 承認待ち への遷移（admin 以上）
-- ============================================================
CREATE POLICY "bud_transfers_update_review_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '確認済み'
    AND bud_is_admin()
  )
  WITH CHECK (
    status IN ('確認済み', '承認待ち', '差戻し')
    AND bud_is_admin()
  );

-- ============================================================
-- 4. 承認待ち → 承認済み への遷移（admin 以上、ただし自起票本人は不可）
-- ============================================================
-- A-05 §9 V6: 起票者本人による承認は禁止（金銭関連の二重チェック原則）
-- super_admin の自起票スキップは別 policy 5 で扱うため、ここでは created_by != auth.uid() を強制
CREATE POLICY "bud_transfers_update_approval_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '承認待ち'
    AND bud_is_admin()
    AND created_by <> auth.uid()
  )
  WITH CHECK (
    status IN ('承認済み', '差戻し')
    AND bud_is_admin()
    AND created_by <> auth.uid()
  );

-- ============================================================
-- 5. super_admin 自起票スキップ（下書き → 承認済み 直接遷移）
-- ============================================================
CREATE POLICY "bud_transfers_update_self_approve_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND created_by = auth.uid()
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = '承認済み'
    AND root_is_super_admin()
  );

-- ============================================================
-- 6. 承認済み → CSV出力済み（super_admin のみ）
-- ============================================================
CREATE POLICY "bud_transfers_update_csv_export_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '承認済み'
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = 'CSV出力済み'
    AND root_is_super_admin()
  );

-- ============================================================
-- 7. CSV出力済み → 振込完了（super_admin のみ）
-- ============================================================
CREATE POLICY "bud_transfers_update_complete_super_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = 'CSV出力済み'
    AND root_is_super_admin()
  )
  WITH CHECK (
    status = '振込完了'
    AND root_is_super_admin()
  );

-- ============================================================
-- 8. DELETE（super_admin のみ、下書きのみ許可）
-- ============================================================
CREATE POLICY "bud_transfers_delete_draft_super_admin" ON bud_transfers
  FOR DELETE
  USING (
    status = '下書き'
    AND root_is_super_admin()
  );

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'bud_transfers'
--   ORDER BY policyname;
--
-- 期待（8 ポリシー）:
--   bud_transfers_select_all           (SELECT)
--   bud_transfers_insert_staff         (INSERT)
--   bud_transfers_update_approval_admin        (UPDATE)
--   bud_transfers_update_complete_super_admin  (UPDATE)
--   bud_transfers_update_csv_export_super_admin (UPDATE)
--   bud_transfers_update_draft_self_or_admin   (UPDATE)
--   bud_transfers_update_review_admin           (UPDATE)
--   bud_transfers_update_self_approve_super_admin (UPDATE)
--   bud_transfers_delete_draft_super_admin      (DELETE)
