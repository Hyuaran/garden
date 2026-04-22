-- ============================================================
-- Garden Root — Phase 1 追加修正: root_audit_log RLS
-- ============================================================
-- 問題:
--   Phase 1 動作確認中、writeAudit() が root_audit_log への
--   INSERT で RLS policy violation を返す。
--   root_audit_log テーブルは RLS が有効だが、INSERT / SELECT
--   のポリシーが定義されていないため全操作が拒否されていた。
--
-- 解決:
--   - INSERT: 全ユーザー (anon 含む) に許可。
--     login_failed は未認証時にも記録する必要があるため anon 必須。
--     payload の内容を検証する仕組みは当面なしでよい (監査ログなので
--     信頼できるログだけが残る前提、不正データは actor_user_id が
--     NULL になる)。
--   - SELECT: admin 以上のみ。
--     監査ログの閲覧画面は Phase 2 以降で追加予定。
--
-- 冪等性: DROP IF EXISTS + CREATE で何度実行してもよい。
-- ============================================================

ALTER TABLE root_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS root_audit_log_insert ON root_audit_log;
DROP POLICY IF EXISTS root_audit_log_select ON root_audit_log;

-- INSERT: 誰でも書込可 (認証前の login_failed 等を記録するため)
CREATE POLICY root_audit_log_insert ON root_audit_log
  FOR INSERT
  WITH CHECK (true);

-- SELECT: admin 以上のみ (監査ログの閲覧制限)
CREATE POLICY root_audit_log_select ON root_audit_log
  FOR SELECT
  USING (root_can_write());
