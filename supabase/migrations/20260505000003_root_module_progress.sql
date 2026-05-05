-- ============================================================
-- Garden Root — モジュール別進捗テーブル（Phase 1a）
-- ============================================================
-- 対応 dispatch: 2026-05-05(火) 19:00 a-main-012 main- No. 53
-- 作成: 2026-05-05（Bloom 開発進捗ページ Phase 1a）
--
-- 目的:
--   Garden 12 モジュール（Bloom / Forest / Tree / Bud / Leaf / Root /
--   Rill / Sprout / Calendar / Soil / Fruit / Seed）の進捗 % を
--   一元管理し、Bloom 開発進捗ページの円グラフ等で参照する。
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   ON CONFLICT DO UPDATE のため、再実行で初期データが上書きされる。
-- ============================================================

-- ------------------------------------------------------------
-- テーブル本体
-- ------------------------------------------------------------
create table if not exists public.root_module_progress (
  module            text primary key,                           -- 'Bloom' / 'Forest' / 'Tree' / ...
  progress_pct      integer not null check (progress_pct between 0 and 100),
  phase             text,                                       -- 'A' / 'B' / 'C' / 'D' / '-'
  status            text,                                       -- '進行中' / '完了' / '実装完了' / 'Phase待ち' / '未着手'
  summary           text,                                       -- 短い説明文（30 字程度）
  updated_at        timestamptz not null default now()
);

comment on table public.root_module_progress is
  'Garden モジュール別進捗（Phase 1a, dispatch main- No. 53）。Bloom 開発進捗ページの円グラフ・進行状況一覧で参照。';
comment on column public.root_module_progress.progress_pct is
  '進捗 %（0-100）。v29 HTML の値を初期値として採用、運用で更新可能';

-- ------------------------------------------------------------
-- updated_at 自動更新
-- ------------------------------------------------------------
drop trigger if exists trg_root_module_progress_updated_at on public.root_module_progress;

create trigger trg_root_module_progress_updated_at
  before update on public.root_module_progress
  for each row execute function public.root_update_updated_at();

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table public.root_module_progress enable row level security;

-- admin / super_admin のみ閲覧
drop policy if exists root_module_progress_select_admin on public.root_module_progress;

create policy root_module_progress_select_admin
  on public.root_module_progress
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
-- 初期データ（v29 HTML の進捗 % を採用、要確認後採用）
-- ------------------------------------------------------------
insert into public.root_module_progress (module, progress_pct, phase, status, summary) values
  ('Bloom',    65, 'B', '進行中',     'グループ全体の動きと業績を見える化'),
  ('Forest',   70, 'B', '進行中',     '法人別経営ダッシュボード'),
  ('Tree',    100, 'D', '実装完了',   '架電アプリ（FileMaker代替）'),
  ('Bud',      55, 'A', '進行中',     '経理・収支・給与'),
  ('Leaf',     60, 'B', '進行中',     '商材×商流ごとの個別アプリ'),
  ('Root',    100, 'A', '実装完了',   '組織・従業員・マスタ'),
  ('Rill',     35, 'C', 'Phase待ち',  'Chatwork 代替メッセージング'),
  ('Sprout',    0, '-', '未着手',     '採用・入社フロー'),
  ('Calendar',  0, '-', '未着手',     '営業予定・シフト'),
  ('Soil',      0, '-', '未着手',     'DB・大量データ基盤'),
  ('Fruit',     0, '-', '未着手',     '法人格の実体・登記・許認可'),
  ('Seed',      0, '-', '未着手',     '新事業・新商材枠')
on conflict (module) do update set
  progress_pct = excluded.progress_pct,
  phase        = excluded.phase,
  status       = excluded.status,
  summary      = excluded.summary,
  updated_at   = now();

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- SELECT * FROM root_module_progress ORDER BY progress_pct DESC;
-- SELECT count(*) FROM root_module_progress;  -- 期待: 12
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'root_module_progress';
