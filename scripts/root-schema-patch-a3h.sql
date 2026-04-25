-- ============================================================
-- Garden Root — Phase A-3-h: 給与関連カラム拡張（Dashboard 実行用コピー）
-- ============================================================
-- 本ファイルは supabase/migrations/20260425000004_root_employees_payroll_extension.sql
-- と同一内容の Dashboard 実行用コピー。
--
-- 適用手順:
--   1. Supabase Dashboard > garden-dev > SQL Editor を開く
--   2. 本ファイルを貼付 → Run
--   3. 末尾の確認クエリで結果チェック
--
-- 目的:
--   Bud Phase B（給与計算）/ Phase C（年末調整・源泉徴収）の前提スキーマ整備。
-- ============================================================

alter table public.root_employees
  add column if not exists kou_otsu text
    check (kou_otsu is null or kou_otsu in ('kou', 'otsu')),
  add column if not exists dependents_count int not null default 0
    check (dependents_count between 0 and 20),
  add column if not exists deleted_at timestamptz;

comment on column public.root_employees.kou_otsu is
  '年末調整の甲/乙欄区分（kou=甲欄=主な収入、otsu=乙欄=副業）';

comment on column public.root_employees.dependents_count is
  '扶養家族人数（0〜20）、源泉徴収税額表のルックアップに使用';

comment on column public.root_employees.deleted_at is
  '論理削除タイムスタンプ、中途退職者の年末調整対応で使用';

create index if not exists idx_root_employees_deleted_at
  on public.root_employees (deleted_at)
  where deleted_at is not null;

-- ------------------------------------------------------------
-- 確認クエリ
-- ------------------------------------------------------------
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'root_employees'
--     AND column_name IN ('kou_otsu', 'dependents_count', 'deleted_at');
--
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'root_employees' AND indexname = 'idx_root_employees_deleted_at';
