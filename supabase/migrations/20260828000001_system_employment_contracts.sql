create table if not exists public.system_employment_contracts (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  payload jsonb not null,
  pdf_status text not null default 'skipped' check (pdf_status in ('generated','skipped','failed')),
  pdf_drive_file_id text,
  pdf_drive_url text,
  pdf_note text,
  created_at timestamptz not null default now()
);
create index if not exists system_employment_contracts_employee_created_idx on public.system_employment_contracts(employee_id, created_at desc);
alter table public.system_employment_contracts enable row level security;
