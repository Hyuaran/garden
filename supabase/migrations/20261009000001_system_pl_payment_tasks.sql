create table if not exists public.system_pl_payment_tasks (
  pl_record_id text primary key,
  pl_revision text,
  category text,
  status text,
  vendor text,
  mf_company text,
  amount bigint,
  due_date date,
  effective_due_date date,
  period_month text,
  notified_new_at timestamptz,
  drive_url text,
  drive_url_set_at timestamptz,
  drive_match_note text,
  transfer_request_id text,
  transfer_execute_id text,
  transfer_id text,
  transfer_created_at timestamptz,
  transfer_note text,
  reminder_sent_on date,
  unreserved_alert_sent_on date,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists system_pl_payment_tasks_effective_due_date_idx
  on public.system_pl_payment_tasks (effective_due_date);

alter table public.system_pl_payment_tasks enable row level security;

drop policy if exists "system_pl_payment_tasks_service_role_all" on public.system_pl_payment_tasks;
create policy "system_pl_payment_tasks_service_role_all"
  on public.system_pl_payment_tasks
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.set_system_pl_payment_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists system_pl_payment_tasks_updated_at on public.system_pl_payment_tasks;
create trigger system_pl_payment_tasks_updated_at
  before update on public.system_pl_payment_tasks
  for each row
  execute function public.set_system_pl_payment_tasks_updated_at();
