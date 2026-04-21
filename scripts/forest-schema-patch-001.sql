-- ============================================================
-- Garden Forest — Schema Patch 001
-- B-2: login_failed を anon ロールでも INSERT できるようにする
--
-- 背景:
--   login_failed は認証「失敗」時に記録するため、認証前（anon）の
--   タイミングで INSERT が発生する。
--   既存ポリシー "forest_audit_insert" は authenticated のみ許可のため、
--   ログインに失敗した記録が一切残らないバグが発生していた。
--
-- Run in: Supabase Dashboard > SQL Editor
-- ============================================================

-- anon ロールが login_failed を user_id IS NULL で INSERT できるポリシー
-- （他の action や user_id に値を入れた INSERT は拒否される）
CREATE POLICY "forest_audit_anon_login_failed" ON forest_audit_log
  FOR INSERT TO anon
  WITH CHECK (
    action = 'login_failed'
    AND user_id IS NULL
  );
