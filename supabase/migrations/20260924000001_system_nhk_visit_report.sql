create table if not exists public.system_nhk_visit_report (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  start_time time not null,
  end_time time not null,
  destination text not null,
  task_name text not null default '対面アプローチ',
  new_ground integer not null default 0,
  new_satellite integer not null default 0,
  address_ground integer not null default 0,
  address_satellite integer not null default 0,
  bank_credit integer not null default 0,
  transport_fee text not null,
  employee_number text not null,
  employee_name text not null,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  kintone_record_id text null,
  kintone_synced_at timestamptz null,
  kintone_error text null,
  created_at timestamptz not null default now(),
  constraint system_nhk_visit_report_destination_check
    check (destination in ('NHK奈良','NHK京都','NHK大阪','NHK大津','NHK神戸')),
  constraint system_nhk_visit_report_transport_fee_check
    check (transport_fee in ('あり','なし')),
  constraint system_nhk_visit_report_counts_check
    check (
      new_ground >= 0
      and new_satellite >= 0
      and address_ground >= 0
      and address_satellite >= 0
      and bank_credit >= 0
    )
);

create index if not exists idx_system_nhk_visit_report_visit_date
  on public.system_nhk_visit_report (visit_date);

create index if not exists idx_system_nhk_visit_report_employee_date
  on public.system_nhk_visit_report (employee_number, visit_date desc);

create index if not exists idx_system_nhk_visit_report_kintone_unsynced
  on public.system_nhk_visit_report (submitted_at)
  where kintone_synced_at is null;

alter table public.system_nhk_visit_report enable row level security;

drop policy if exists system_nhk_visit_report_select_staff on public.system_nhk_visit_report;
create policy system_nhk_visit_report_select_staff
  on public.system_nhk_visit_report
  for select
  using (public.garden_role_of(auth.uid()) in ('staff','outsource','manager','admin','super_admin'));
