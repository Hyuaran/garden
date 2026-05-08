-- ============================================================
-- Garden Bud — RLS v3 a-review 重大指摘修正
-- ============================================================
-- 作成: 2026-04-25
-- 目的: PR #55 a-review 重大指摘 3 件のうち RLS 関連 2 件 + 関連修正を反映
--
-- 適用順序:
--   1. scripts/bud-schema.sql
--   2. scripts/bud-rls.sql
--   3. scripts/bud-transfers-v2.sql
--   4. scripts/bud-rls-v2.sql
--   5. scripts/bud-a03-status-history-migration.sql（V6 自己承認禁止）
--   6. scripts/bud-rls-v3-review-fixes.sql ← 本ファイル
--
-- 修正内容:
--   B1 (金銭関連 RLS): policy 2 を分割し、起票者本人による「確認済み」遷移を禁止
--   B2 (状態遷移違反): policy 3 の WITH CHECK から '差戻し' を除外（canTransition と整合）
--   B4 (状態遷移違反): policy 7 を super_admin only → admin+ に緩和（A-05 spec §6 準拠）
-- ============================================================

-- ============================================================
-- B1 修正: 下書き → 確認済み の自己実施を禁止
-- ============================================================
-- 既存 policy 2 は status='下書き' のときの全 UPDATE を起票者 or admin に許可していた
-- → 起票者本人が「確認済み」へ遷移可能（二重チェック原則違反）
-- 解決: policy 2 を 2 つに分割
--   2a: 下書き内編集（status='下書き' → status='下書き'）— 起票者 or admin 可
--   2b: 下書き → 確認済み 遷移 — admin 以上、かつ起票者以外（V6 と同方針）

DROP POLICY IF EXISTS "bud_transfers_update_draft_self_or_admin" ON bud_transfers;

-- 2a: 下書き内編集
CREATE POLICY "bud_transfers_update_draft_edit" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND (created_by = auth.uid() OR bud_is_admin())
  )
  WITH CHECK (
    status = '下書き'
    AND (created_by = auth.uid() OR bud_is_admin())
  );

-- 2b: 下書き → 確認済み 遷移（admin 以上 + 起票者以外）
-- super_admin の自起票スキップは別 policy 5（下書き → 承認済み）で扱うため、
-- ここでは super_admin であっても起票者本人を弾く（自起票は policy 5 経由のみ）
CREATE POLICY "bud_transfers_update_draft_to_confirmed" ON bud_transfers
  FOR UPDATE
  USING (
    status = '下書き'
    AND bud_is_admin()
    AND created_by <> auth.uid()
  )
  WITH CHECK (
    status = '確認済み'
    AND bud_is_admin()
    AND created_by <> auth.uid()
  );

-- ============================================================
-- B2 修正: 確認済み → 差戻し を不許可（canTransition と整合）
-- ============================================================
-- canTransition: 確認済み → ['承認待ち', '下書き'] のみ
-- 旧 policy 3: WITH CHECK status IN ('確認済み', '承認待ち', '差戻し')
-- → '差戻し' を除外して canTransition と整合させる

DROP POLICY IF EXISTS "bud_transfers_update_review_admin" ON bud_transfers;

CREATE POLICY "bud_transfers_update_review_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = '確認済み'
    AND bud_is_admin()
  )
  WITH CHECK (
    status IN ('確認済み', '承認待ち', '下書き')
    AND bud_is_admin()
  );

-- ============================================================
-- B4 修正: 振込完了マークを admin+ に緩和
-- ============================================================
-- A-05 spec §6 の役割表では admin+ で CSV 出力済み → 振込完了 へ遷移可
-- 旧 policy 7: super_admin のみ → 業務上 admin が完了マークできずブロック
-- A-06 自動照合（admin 操作）が振込完了に遷移させるため、admin+ に緩和必須

DROP POLICY IF EXISTS "bud_transfers_update_complete_super_admin" ON bud_transfers;

CREATE POLICY "bud_transfers_update_complete_admin" ON bud_transfers
  FOR UPDATE
  USING (
    status = 'CSV出力済み'
    AND bud_is_admin()
  )
  WITH CHECK (
    status = '振込完了'
    AND bud_is_admin()
  );

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'bud_transfers'
--   ORDER BY policyname;
--
-- 期待（適用後 9 ポリシー）:
--   bud_transfers_select_all                       (SELECT)
--   bud_transfers_insert_staff                     (INSERT)
--   bud_transfers_update_approval_admin            (UPDATE) — V6 created_by != auth.uid()
--   bud_transfers_update_complete_admin            (UPDATE) — B4 修正で super_admin → admin+
--   bud_transfers_update_csv_export_super_admin    (UPDATE)
--   bud_transfers_update_draft_edit                (UPDATE) — B1 分割 2a
--   bud_transfers_update_draft_to_confirmed        (UPDATE) — B1 分割 2b（自己実施禁止）
--   bud_transfers_update_review_admin              (UPDATE) — B2 差戻し除外
--   bud_transfers_update_self_approve_super_admin  (UPDATE)
--   bud_transfers_delete_draft_super_admin         (DELETE)
