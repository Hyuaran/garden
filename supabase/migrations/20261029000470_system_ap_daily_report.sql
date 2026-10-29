create table public.system_ap_daily_report (
 id uuid primary key default gen_random_uuid(),
 employee_id text not null references public.root_employees(employee_id),
 employee_number text not null, employee_name text not null,
 report_date date not null, kind text not null check(kind in ('toss','closer')),
 start_time time not null, end_time time not null, work_minutes integer not null check(work_minutes >= 0),
 calls integer not null, absent integer not null, prospect integer not null, effective_rate numeric not null,
 auto_count integer not null, count integer not null check(count >= 0),
 month_total numeric(12,1) not null, efficiency numeric not null,
 coin_created integer check(coin_created >= 0), guide_promised integer check(guide_promised >= 0),
 guide_in_progress integer check(guide_in_progress >= 0), statement_check_request integer check(statement_check_request >= 0),
 coin_total integer check(coin_total >= 0), reflection text not null check(length(btrim(reflection)) > 0),
 chatwork_message_id text, chatwork_error text, sent_count integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(employee_id,report_date), check(end_time > start_time)
);
alter table public.system_ap_daily_report enable row level security;
revoke all on public.system_ap_daily_report from anon, authenticated;
grant select on public.system_ap_daily_report to authenticated;
grant all on public.system_ap_daily_report to service_role;
create policy ap_daily_report_read on public.system_ap_daily_report for select to authenticated using (
 exists(select 1 from public.root_employees e where e.user_id=auth.uid() and e.is_active and e.deleted_at is null
 and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
 and (e.employee_id=system_ap_daily_report.employee_id or e.garden_role='super_admin'))
);
