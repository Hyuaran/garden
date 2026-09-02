-- 管理表ポータル 段階1：取り込みの記録・取り込んだ生データ・月の設定（定休日）
-- Supabase の SQL Editor で実行する。小さな表3つと閲覧の決まりだけ。既存の表は触らない。
begin;

-- 1) 取り込みの記録（1回の「取り込む」＝1行）
create table if not exists public.system_kanri_run (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  mode text not null default 'daily' check (mode in ('daily','closing')),
  created_by uuid not null references auth.users(id),
  creator_name text not null,
  status text not null default 'pending' check (status in ('pending','fetching','fetched','failed')),
  summary jsonb,          -- 取得元ごとの件数など {"kintone_customer": 128, "kanden_report": 41, ...}
  warnings jsonb,         -- 注意の一覧 [{"code":"staff_not_in_roster","detail":"..."}]
  error_code text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_system_kanri_run_date on public.system_kanri_run(target_date desc, created_at desc);

-- 2) 取り込んだ生データ（取得元ごとに1レコード1行。Kintoneのレコードをそのまま JSON で持つ）
create table if not exists public.system_kanri_source_row (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.system_kanri_run(id) on delete cascade,
  source text not null,   -- 'kintone_customer' | 'kanden_report' | 'credit_card' | 'roster'
  source_app text,        -- Kintone のアプリ番号（クレカは 66/84/... で区別）
  record_id text not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  unique (run_id, source, source_app, record_id)
);
create index if not exists idx_system_kanri_source_row_run on public.system_kanri_source_row(run_id, source);

-- 3) 月の設定（定休日）。月初にポータルで登録する
create table if not exists public.system_kanri_month_setting (
  year_month text primary key check (year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  holidays date[] not null default '{}',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- 閲覧は責任者以上。書き込みはサーバー（service_role）だけ。
alter table public.system_kanri_run enable row level security;
alter table public.system_kanri_source_row enable row level security;
alter table public.system_kanri_month_setting enable row level security;

drop policy if exists system_kanri_run_select_manager on public.system_kanri_run;
create policy system_kanri_run_select_manager on public.system_kanri_run
  for select to authenticated using (public.has_role_at_least('manager'));
drop policy if exists system_kanri_source_row_select_manager on public.system_kanri_source_row;
create policy system_kanri_source_row_select_manager on public.system_kanri_source_row
  for select to authenticated using (public.has_role_at_least('manager'));
drop policy if exists system_kanri_month_setting_select_manager on public.system_kanri_month_setting;
create policy system_kanri_month_setting_select_manager on public.system_kanri_month_setting
  for select to authenticated using (public.has_role_at_least('manager'));

grant select on public.system_kanri_run, public.system_kanri_source_row, public.system_kanri_month_setting to authenticated;
grant all on public.system_kanri_run, public.system_kanri_source_row, public.system_kanri_month_setting to service_role;
grant usage, select on sequence public.system_kanri_source_row_id_seq to service_role;

comment on table public.system_kanri_run is '管理表ポータルの取り込み記録。1回の「取り込む」で1行。';
comment on table public.system_kanri_source_row is '管理表ポータルが Kintone から取り込んだ生データ。payload は Kintone のレコードそのまま。';
comment on table public.system_kanri_month_setting is '管理表ポータルの月の設定。定休日を月初に登録する。';

commit;
