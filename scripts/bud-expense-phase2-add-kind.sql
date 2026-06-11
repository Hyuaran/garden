-- ============================================================
-- Garden Bud — 経費精算 Phase 2 追加: 経費区分（会社経費/個別経費）
-- bud_expense_requests に expense_kind 列を追加（既定 individual=個別経費）。
-- 安全（IF NOT EXISTS・既存行は既定値で埋まる）。Supabase SQL Editor で実行。
-- ============================================================
ALTER TABLE public.bud_expense_requests
  ADD COLUMN IF NOT EXISTS expense_kind text NOT NULL DEFAULT 'individual'
  CHECK (expense_kind IN ('individual','company'));

NOTIFY pgrst, 'reload schema';
