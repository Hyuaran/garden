-- ============================================================
-- Garden Root — 日報明細テーブル（Phase 1a）
-- ============================================================
-- 対応 dispatch: 2026-05-05(火) 19:00 a-main-012 main- No. 53
-- 作成: 2026-05-05（Bloom 開発進捗ページ Phase 1a）
--
-- 目的:
--   日報の各エントリ（work_logs / tomorrow_plans / carryover /
--   planned_for_today / 特記事項）を 1 行 = 1 エントリで保存。
--   Garden モジュール抽出（"Garden XXX：内容" → module="XXX"）も保持。
--
-- 関連:
--   - root_daily_reports: 親テーブル（date が FK）
--
-- 適用方法:
--   親テーブル root_daily_reports 適用後に本ファイルを実行。
-- ============================================================

-- ------------------------------------------------------------
-- テーブル本体
-- ------------------------------------------------------------
create table if not exists public.root_daily_report_logs (
  id                bigserial primary key,
  report_date       date not null
                    references public.root_daily_reports(date)
                    on delete cascade,

  -- カテゴリ
  category          text not null
                    check (category in ('work', 'tomorrow', 'carryover', 'planned', 'special')),

  -- モジュール抽出結果
  module            text,                                       -- 'Bloom' / 'Forest' / 'Tree' / 'Root' / ... / null

  -- 本文
  content           text not null,

  -- 表示順
  ord               integer not null default 0,

  -- 監査
  created_at        timestamptz not null default now()
);

comment on table public.root_daily_report_logs is
  '日報明細（Phase 1a, dispatch main- No. 53）。1 行 = 1 work_log エントリ。category で work/tomorrow/carryover/planned/special を区別。';
comment on column public.root_daily_report_logs.module is
  'Garden モジュール抽出結果。"Garden XXX：..." → "XXX"、抽出不可は null';
comment on column public.root_daily_report_logs.ord is
  '同 report_date + category 内の表示順（0 origin、配列順を保持）';

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
create index if not exists idx_root_daily_report_logs_date
  on public.root_daily_report_logs (report_date);

create index if not exists idx_root_daily_report_logs_module
  on public.root_daily_report_logs (module);

-- カテゴリ別絞込（Bloom 進捗ページで「明日の予定」のみ抽出時等）
create index if not exists idx_root_daily_report_logs_date_category
  on public.root_daily_report_logs (report_date, category, ord);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.root_daily_report_logs enable row level security;

-- admin / super_admin のみ閲覧
drop policy if exists root_daily_report_logs_select_admin on public.root_daily_report_logs;

create policy root_daily_report_logs_select_admin
  on public.root_daily_report_logs
  for select
  using (
    exists (
      select 1 from public.root_employees e
      where e.user_id = auth.uid()
        and e.is_active = true
        and e.garden_role in ('admin', 'super_admin')
    )
  );

-- service_role は RLS をバイパス、anon / authenticated からの書込は不許可。

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'root_daily_report_logs';
-- SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'root_daily_report_logs';
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'root_daily_report_logs';
-- SELECT report_date, category, count(*) FROM root_daily_report_logs GROUP BY 1, 2 ORDER BY 1 DESC;
