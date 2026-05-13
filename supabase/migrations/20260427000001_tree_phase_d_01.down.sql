-- ============================================================
-- Garden Tree Phase D-01 — schema migration ROLLBACK
-- ============================================================
-- 対応 up    : supabase/migrations/20260427000001_tree_phase_d_01.sql
-- 作成      : 2026-04-27（a-tree）
--
-- 用途:
--   dev 環境で up→down→up の冪等性確認、または投入失敗時の緊急 rollback。
--   本番（garden）で実行してはならない（データ全消失）。
--
-- 実行順序: 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → 1（依存順の逆）
-- ============================================================

BEGIN;

-- ============================================================
-- 9. 監査ログ Trigger 撤去
-- ============================================================
DROP TRIGGER IF EXISTS tcs_audit_after_insert  ON tree_calling_sessions;
DROP TRIGGER IF EXISTS tcs_audit_after_update  ON tree_calling_sessions;
DROP TRIGGER IF EXISTS tcr_audit_after_insert  ON tree_call_records;
DROP TRIGGER IF EXISTS tcr_audit_after_update  ON tree_call_records;
DROP TRIGGER IF EXISTS taa_audit_after_insert  ON tree_agent_assignments;
DROP TRIGGER IF EXISTS taa_audit_after_update  ON tree_agent_assignments;

DROP FUNCTION IF EXISTS trg_audit_tree_session()    CASCADE;
DROP FUNCTION IF EXISTS trg_audit_tree_call()       CASCADE;
DROP FUNCTION IF EXISTS trg_audit_tree_assignment() CASCADE;
DROP FUNCTION IF EXISTS trg_audit_safe_insert(text, text, jsonb) CASCADE;


-- ============================================================
-- 8. VIEW 撤去
-- ============================================================
DROP VIEW IF EXISTS v_tree_legacy_history;
DROP VIEW IF EXISTS v_tree_operator_today;


-- ============================================================
-- 7. RLS ポリシー撤去
-- ============================================================
-- tree_agent_assignments
DROP POLICY IF EXISTS taa_select_self          ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_insert_self_pull     ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_update_self_release  ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_select_manager       ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_insert_manager       ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_update_manager       ON tree_agent_assignments;
DROP POLICY IF EXISTS taa_all_admin            ON tree_agent_assignments;

-- tree_call_records
DROP POLICY IF EXISTS tcr_select_self        ON tree_call_records;
DROP POLICY IF EXISTS tcr_insert_self        ON tree_call_records;
DROP POLICY IF EXISTS tcr_update_self_today  ON tree_call_records;
DROP POLICY IF EXISTS tcr_select_manager     ON tree_call_records;
DROP POLICY IF EXISTS tcr_all_admin          ON tree_call_records;
DROP POLICY IF EXISTS tcr_no_delete          ON tree_call_records;

-- tree_calling_sessions
DROP POLICY IF EXISTS tcs_select_self          ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_insert_self          ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_update_self_open     ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_select_manager       ON tree_calling_sessions;
DROP POLICY IF EXISTS tcs_all_admin            ON tree_calling_sessions;

-- RLS 自体を OFF（テーブル DROP 前に明示的に無効化）
ALTER TABLE IF EXISTS tree_agent_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tree_call_records      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tree_calling_sessions  DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. 列制限・updated_at Trigger 撤去
-- ============================================================
DROP TRIGGER IF EXISTS tcr_before_update  ON tree_call_records;
DROP TRIGGER IF EXISTS tcs_before_update  ON tree_calling_sessions;
DROP TRIGGER IF EXISTS taa_before_update  ON tree_agent_assignments;

DROP FUNCTION IF EXISTS trg_tcr_guard_immutable() CASCADE;
DROP FUNCTION IF EXISTS trg_tcs_touch_updated_at() CASCADE;


-- ============================================================
-- 5. 集計 Trigger 撤去
-- ============================================================
DROP TRIGGER IF EXISTS tcr_after_insert ON tree_call_records;
DROP FUNCTION IF EXISTS trg_tcr_update_session_totals() CASCADE;


-- ============================================================
-- 4. soil_call_lists 連携カラム撤去
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'soil_call_lists') THEN
    -- FK を先に外す
    ALTER TABLE soil_call_lists DROP CONSTRAINT IF EXISTS fk_scl_last_tree_session;
    ALTER TABLE soil_call_lists DROP CONSTRAINT IF EXISTS fk_scl_last_tree_call;

    -- 列削除
    ALTER TABLE soil_call_lists
      DROP COLUMN IF EXISTS last_tree_session_id,
      DROP COLUMN IF EXISTS last_tree_call_id,
      DROP COLUMN IF EXISTS last_tree_touched_at;
  END IF;
END $$;


-- ============================================================
-- 3. tree_agent_assignments 撤去
-- ============================================================
ALTER TABLE IF EXISTS tree_agent_assignments DROP CONSTRAINT IF EXISTS fk_taa_list_soil;
DROP TABLE IF EXISTS tree_agent_assignments CASCADE;


-- ============================================================
-- 2. tree_call_records 撤去
-- ============================================================
ALTER TABLE IF EXISTS tree_call_records DROP CONSTRAINT IF EXISTS fk_tcr_list_soil;
DROP TABLE IF EXISTS tree_call_records CASCADE;


-- ============================================================
-- 1. tree_calling_sessions 撤去
-- ============================================================
DROP TABLE IF EXISTS tree_calling_sessions CASCADE;


COMMIT;

-- 適用後の確認:
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name LIKE 'tree_%' ORDER BY table_name;
-- → tree_call_records / tree_calling_sessions / tree_agent_assignments が消えていれば OK
