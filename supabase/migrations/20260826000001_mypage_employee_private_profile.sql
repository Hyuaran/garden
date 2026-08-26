-- Apply manually after approval. Adds only the storage needed by the employee mypage.
alter table public.root_employees
  add column if not exists commute_daily_allowance integer,
  add column if not exists commute_monthly_cap integer;

alter table public.root_employees
  drop constraint if exists root_employees_commute_daily_allowance_nonnegative,
  add constraint root_employees_commute_daily_allowance_nonnegative check (commute_daily_allowance is null or commute_daily_allowance >= 0),
  drop constraint if exists root_employees_commute_monthly_cap_nonnegative,
  add constraint root_employees_commute_monthly_cap_nonnegative check (commute_monthly_cap is null or commute_monthly_cap >= 0);

comment on column public.root_employees.commute_daily_allowance is '申告された通勤交通費の日額（円）';
comment on column public.root_employees.commute_monthly_cap is '従業員ごとの通勤交通費月額上限（円）';

create table if not exists public.root_employee_my_numbers (
  employee_id uuid primary key references public.root_employees(id) on delete cascade,
  my_number text not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.root_employee_my_numbers enable row level security;
revoke all on table public.root_employee_my_numbers from public, anon, authenticated;
grant all on table public.root_employee_my_numbers to service_role;

drop trigger if exists root_employee_my_numbers_updated_at on public.root_employee_my_numbers;
create trigger root_employee_my_numbers_updated_at before update on public.root_employee_my_numbers
for each row execute function public.root_update_updated_at();

comment on table public.root_employee_my_numbers is 'マイナンバー保管。RLSポリシーなし・service_role限定。一般APIは番号を取得せず行の存在だけを確認する。';
