create table if not exists public.system_contracts (
  id uuid primary key default gen_random_uuid(),
  counterparty text not null,
  company_id text not null,
  contract_type text not null,
  concluded_on date not null,
  note text,
  drive_file_id text,
  drive_url text,
  drive_folder_name text,
  template_file_id text,
  template_url text,
  template_generated_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
alter table public.system_contracts enable row level security;
create index if not exists system_contracts_created_at_idx on public.system_contracts(created_at desc);
