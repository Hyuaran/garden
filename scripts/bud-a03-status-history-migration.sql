-- ============================================================
-- Bud A-03: 振込 6 段階遷移 差分 migration
-- ============================================================
-- 前提: scripts/bud-transfers-v2.sql + scripts/bud-rls-v2.sql 適用済
-- 追加: 状態遷移履歴テーブル、遷移判定 PL/pgSQL、atomic RPC、RLS
-- 東海林判断（pending-judgments.md）:
--   A-03 判1: bud_transfer_status_history と root_audit_log の両方記録（本 migration は history のみ、root_audit_log 二重記録は後続 Phase で実装）
--   A-03 判3: super_admin 自起票時の reason は '自起票' 固定文字列

-- ============================================================
-- 1. bud_transfers への列追加
-- ============================================================
-- 最新の遷移タイムスタンプ・実行者を bud_transfers 側に保持（UI の一覧表示・照合用）

-- 実 PK は transfer_id (text, FK-YYYYMMDD-NNNNNN)。id uuid は存在しない。
ALTER TABLE bud_transfers
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES auth.users(id);

COMMENT ON COLUMN bud_transfers.status_changed_at IS
  '最新のステータス変更日時。bud_transfer_status_history の最新行と一致';
COMMENT ON COLUMN bud_transfers.status_changed_by IS
  '最新のステータス変更者（auth.users.id）。監査はこの列＋history テーブルで追跡';

-- ============================================================
-- 2. bud_transfer_status_history テーブル（追記型・永続）
-- ============================================================

CREATE TABLE IF NOT EXISTS bud_transfer_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id     text NOT NULL REFERENCES bud_transfers(transfer_id) ON DELETE CASCADE,
  from_status     text,
  to_status       text NOT NULL CHECK (to_status IN (
    '下書き', '確認済み', '承認待ち', '承認済み',
    'CSV出力済み', '振込完了', '差戻し'
  )),
  changed_at      timestamptz NOT NULL DEFAULT now(),
  changed_by      uuid NOT NULL REFERENCES auth.users(id),
  changed_by_role text NOT NULL,
  reason          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bud_transfer_status_history_transfer_idx
  ON bud_transfer_status_history (transfer_id, changed_at DESC);

COMMENT ON TABLE bud_transfer_status_history IS
  '振込ステータス遷移の追記型ログ。永続保持。初回 INSERT は from_status=NULL';
COMMENT ON COLUMN bud_transfer_status_history.changed_by_role IS
  'at-time snapshot の garden_role。後からロールが変わっても監査は変わらない';
COMMENT ON COLUMN bud_transfer_status_history.reason IS
  '差戻し理由・自起票スキップの「自起票」等、遷移の文脈情報';

-- ============================================================
-- 3. bud_can_transition() 遷移判定関数
-- ============================================================
-- TypeScript 側の canTransition() と完全一致させる（spec §6 の遷移表）

CREATE OR REPLACE FUNCTION bud_can_transition(
  old_status text,
  new_status text,
  user_role text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN user_role = 'super_admin' AND old_status = '下書き' AND new_status = '承認済み'
      THEN true

    WHEN old_status = '下書き'       AND new_status IN ('確認済み', '差戻し')  THEN true
    WHEN old_status = '確認済み'     AND new_status IN ('承認待ち', '下書き')  THEN true
    WHEN old_status = '承認待ち'     AND new_status IN ('承認済み', '差戻し')  THEN true
    WHEN old_status = '承認済み'     AND new_status = 'CSV出力済み'           THEN true
    WHEN old_status = 'CSV出力済み'  AND new_status = '振込完了'               THEN true
    WHEN old_status = '差戻し'       AND new_status = '下書き'                 THEN true

    ELSE false
  END
$$;

COMMENT ON FUNCTION bud_can_transition(text, text, text) IS
  '遷移可否判定。TypeScript の _constants/transfer-status.ts と完全同値';

-- ============================================================
-- 4. bud_transition_transfer_status() atomic RPC
-- ============================================================
-- UPDATE と history INSERT を単一トランザクションで実行
-- super_admin 自起票スキップ時は reason='自起票' 自動挿入（A-03 判3）

CREATE OR REPLACE FUNCTION bud_transition_transfer_status(
  p_transfer_id text,
  p_to_status text,
  p_reason text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status     text;
  v_user_role      text;
  v_history_id     uuid;
  v_effective_reason text;
  v_created_by     uuid;
BEGIN
  -- 1. 遷移元取得 + 行ロック（楽観ロック代わり）
  SELECT status, created_by INTO v_old_status, v_created_by
    FROM bud_transfers
    WHERE transfer_id = p_transfer_id
    FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'transfer not found: %', p_transfer_id
      USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  -- 2. ユーザーの garden_role 取得（root_employees から）
  SELECT garden_role INTO v_user_role
    FROM root_employees
    WHERE user_id = auth.uid();

  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'user not registered in root_employees: %', auth.uid()
      USING ERRCODE = 'INSUFFICIENT_PRIVILEGE';
  END IF;

  -- 3. 遷移可否チェック
  IF NOT bud_can_transition(v_old_status, p_to_status, v_user_role) THEN
    RAISE EXCEPTION 'invalid transition: % -> % by role %', v_old_status, p_to_status, v_user_role
      USING ERRCODE = 'CHECK_VIOLATION';
  END IF;

  -- 3.5 A-05 §9 V6: 自己承認禁止
  -- 承認待ち → 承認済み の遷移は起票者本人不可（金銭関連の二重チェック原則）
  -- ただし super_admin 自起票スキップ（下書き → 承認済み）は除外
  IF v_old_status = '承認待ち' AND p_to_status = '承認済み' AND v_created_by = auth.uid() THEN
    RAISE EXCEPTION 'self-approval is not allowed: 起票者本人による承認は不可'
      USING ERRCODE = 'INSUFFICIENT_PRIVILEGE';
  END IF;

  -- 4. 差戻し時の reason 必須チェック
  IF p_to_status = '差戻し' AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'reason required for transition to 差戻し'
      USING ERRCODE = 'INVALID_PARAMETER_VALUE';
  END IF;

  -- 5. super_admin 自起票スキップ時は reason='自起票' を自動挿入（A-03 判3）
  IF v_user_role = 'super_admin' AND v_old_status = '下書き' AND p_to_status = '承認済み' THEN
    v_effective_reason := COALESCE(NULLIF(btrim(p_reason), ''), '自起票');
  ELSE
    v_effective_reason := p_reason;
  END IF;

  -- 6. bud_transfers UPDATE
  UPDATE bud_transfers
    SET status = p_to_status,
        status_changed_at = now(),
        status_changed_by = auth.uid()
    WHERE transfer_id = p_transfer_id;

  -- 7. status_history INSERT
  INSERT INTO bud_transfer_status_history (
    transfer_id, from_status, to_status,
    changed_by, changed_by_role, reason
  )
  VALUES (
    p_transfer_id, v_old_status, p_to_status,
    auth.uid(), v_user_role, v_effective_reason
  )
  RETURNING id INTO v_history_id;

  RETURN json_build_object(
    'history_id', v_history_id,
    'from_status', v_old_status,
    'to_status', p_to_status,
    'changed_by_role', v_user_role,
    'effective_reason', v_effective_reason
  );
END;
$$;

COMMENT ON FUNCTION bud_transition_transfer_status(text, text, text) IS
  '振込ステータス遷移を atomic 実行（UPDATE + history INSERT）。失敗時は全体 rollback';

-- ============================================================
-- 5. bud_transfer_status_history の RLS
-- ============================================================

ALTER TABLE bud_transfer_status_history ENABLE ROW LEVEL SECURITY;

-- SELECT: admin 以上は全件、staff は自分が起票した振込分のみ（起票者自身の履歴参照用）
DROP POLICY IF EXISTS bud_tsh_select_admin ON bud_transfer_status_history;
CREATE POLICY bud_tsh_select_admin ON bud_transfer_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM root_employees re
      WHERE re.user_id = auth.uid()
        AND re.garden_role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS bud_tsh_select_staff_own ON bud_transfer_status_history;
CREATE POLICY bud_tsh_select_staff_own ON bud_transfer_status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bud_transfers bt
      -- a-review #55 R1 修正 (2026-04-27 a-bud): bud_transfers の PK は transfer_id (text, FRK-YYYYMMDD-NNNNNN)。
      -- bt.id 列は存在しないため、staff/closer/cs/toss ロールが status_history を SELECT すると
      -- SQL ERROR で失敗 → 振込履歴の RLS が機能不全 (admin 以外の正当な参照が一律拒否される) 状態だった。
      WHERE bt.transfer_id = bud_transfer_status_history.transfer_id
        AND bt.created_by = auth.uid()
    )
  );

-- INSERT: RPC 経由のみ（SECURITY DEFINER）。直接 INSERT は禁止
DROP POLICY IF EXISTS bud_tsh_insert_none ON bud_transfer_status_history;
CREATE POLICY bud_tsh_insert_none ON bud_transfer_status_history
  FOR INSERT
  WITH CHECK (false);

-- UPDATE/DELETE: 追記型のため全面禁止
DROP POLICY IF EXISTS bud_tsh_no_update ON bud_transfer_status_history;
CREATE POLICY bud_tsh_no_update ON bud_transfer_status_history
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS bud_tsh_no_delete ON bud_transfer_status_history;
CREATE POLICY bud_tsh_no_delete ON bud_transfer_status_history
  FOR DELETE
  USING (false);

-- ============================================================
-- 6. RPC への GRANT
-- ============================================================

GRANT EXECUTE ON FUNCTION bud_transition_transfer_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION bud_can_transition(text, text, text) TO authenticated;

-- ============================================================
-- 7. 確認クエリ（東海林さん手動実行用）
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_name = 'bud_transfer_status_history'
--   ORDER BY ordinal_position;
--
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bud_transfer_status_history';
--
-- -- 遷移可否のサンプルテスト
-- SELECT bud_can_transition('下書き', '確認済み', 'staff');      -- true
-- SELECT bud_can_transition('下書き', '承認済み', 'super_admin'); -- true
-- SELECT bud_can_transition('下書き', '承認済み', 'staff');      -- false
-- SELECT bud_can_transition('振込完了', '下書き', 'super_admin'); -- false（終端）
