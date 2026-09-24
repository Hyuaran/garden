create table if not exists public.system_line_target (
  id uuid primary key default gen_random_uuid(),
  line_target_id text not null unique,
  target_type text not null,
  purpose text not null default 'nhk_visit',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz null
);

create table if not exists public.system_nhk_visit_daily_report_log (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  destination text not null,
  body text not null,
  succeeded boolean not null,
  error text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_nhk_visit_daily_report_log_date
  on public.system_nhk_visit_daily_report_log (report_date desc);

alter table public.system_line_target enable row level security;
alter table public.system_nhk_visit_daily_report_log enable row level security;

drop policy if exists system_line_target_select_staff on public.system_line_target;
create policy system_line_target_select_staff
  on public.system_line_target
  for select
  using (public.garden_role_of(auth.uid()) in ('staff','outsource','manager','admin','super_admin'));

drop policy if exists system_nhk_visit_daily_report_log_select_staff on public.system_nhk_visit_daily_report_log;
create policy system_nhk_visit_daily_report_log_select_staff
  on public.system_nhk_visit_daily_report_log
  for select
  using (public.garden_role_of(auth.uid()) in ('staff','outsource','manager','admin','super_admin'));
