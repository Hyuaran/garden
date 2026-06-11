-- ============================================================
-- Garden Bud — 経費精算: レシート時刻列の追加
-- 同日・同店・同額レシートの識別用（Driveファイル名にも使用。不明は9999扱い）。
-- Supabase SQL Editor で実行。安全（列追加のみ）。
-- ============================================================
ALTER TABLE public.bud_expense_requests
  ADD COLUMN IF NOT EXISTS receipt_time time;

NOTIFY pgrst, 'reload schema';
