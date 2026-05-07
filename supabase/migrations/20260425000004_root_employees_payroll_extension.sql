-- ============================================================
-- Garden Root — 従業員マスタ 給与関連カラム拡張（Phase A-3-h）
-- ============================================================
-- 対応 Issue / spec: a-main 2026-04-24 Bud Phase B/C 準備
-- 作成: 2026-04-25
--
-- 目的:
--   Bud Phase B（給与計算）/ Phase C（年末調整・源泉徴収）実装前に、
--   root_employees へ以下 3 列を追加し、Bud 側のボトルネックを解消する：
--     - kou_otsu          年末調整の甲欄 / 乙欄区分（源泉徴収税額表ルックアップ）
--     - dependents_count  扶養家族人数
--     - deleted_at        論理削除タイムスタンプ（中途退職者の年末調整対応）
--
--   既存の `is_active` (bool) / `termination_date` (date) と役割分担:
--     - is_active: 一時的な無効化（復帰可能）
--     - termination_date: 正式退職日（給与計算の打切り日）
--     - deleted_at: 論理削除（UI からは見えなくするが DB には残す、監査・集計用）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase A 完走時にまとめて。
--
-- 冪等性: add column if not exists / create index if not exists で何度でも実行可。
-- ============================================================

-- ------------------------------------------------------------
-- 1. kou_otsu: 年末調整 甲欄 / 乙欄 区分
-- ------------------------------------------------------------
alter table public.root_employees
  add column if not exists kou_otsu text
    check (kou_otsu is null or kou_otsu in ('kou', 'otsu'));

comment on column public.root_employees.kou_otsu is
  '年末調整の甲/乙欄区分（kou=甲欄=主な収入、otsu=乙欄=副業）。null は未設定。';

-- ------------------------------------------------------------
-- 2. dependents_count: 扶養家族人数
-- ------------------------------------------------------------
alter table public.root_employees
  add column if not exists dependents_count int not null default 0
    check (dependents_count between 0 and 20);

comment on column public.root_employees.dependents_count is
  '扶養家族人数（0〜20）、源泉徴収税額表のルックアップに使用。既定 0。';

-- ------------------------------------------------------------
-- 3. deleted_at: 論理削除タイムスタンプ
-- ------------------------------------------------------------
alter table public.root_employees
  add column if not exists deleted_at timestamptz;

comment on column public.root_employees.deleted_at is
  '論理削除タイムスタンプ。null なら有効、値があれば削除済み扱い。'
  ' is_active=false との違いは可逆性：deleted_at は通常戻さない想定（監査・集計は残す）。'
  ' 中途退職者の年末調整対応で活用。';

-- ------------------------------------------------------------
-- 4. Index: deleted_at 部分インデックス（削除済行のみ）
--    is_active との組合せより高速に「削除された従業員のみ抽出」が可能
-- ------------------------------------------------------------
create index if not exists idx_root_employees_deleted_at
  on public.root_employees (deleted_at)
  where deleted_at is not null;

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- -- カラム確認
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name = 'root_employees'
--     AND column_name IN ('kou_otsu', 'dependents_count', 'deleted_at');
--
-- -- CHECK 制約確認
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.root_employees'::regclass
--     AND conname LIKE '%kou_otsu%' OR conname LIKE '%dependents_count%';
--
-- -- Index 確認
-- SELECT indexname, indexdef FROM pg_indexes
--   WHERE tablename = 'root_employees' AND indexname = 'idx_root_employees_deleted_at';
