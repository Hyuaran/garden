-- system bank master monthly import / validity / successor mapping

alter table public.system_bank_master
  add column if not exists valid_from date not null default '2026-08-24',
  add column if not exists valid_to date,
  add column if not exists source_date date not null default '2026-08-24',
  add column if not exists updated_at timestamptz not null default now();

alter table public.system_bank_branches
  add column if not exists valid_from date not null default '2026-08-24',
  add column if not exists valid_to date,
  add column if not exists source_date date not null default '2026-08-24',
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_system_bank_master_valid
  on public.system_bank_master (valid_to);

create index if not exists idx_system_bank_branches_valid
  on public.system_bank_branches (bank_code, valid_to);

create table if not exists public.system_bank_datasets (
  id uuid primary key default gen_random_uuid(),
  source_date date not null,
  source_md5 text not null,
  status text not null check (status in ('ok','skipped_same','failed')),
  bank_count int,
  branch_count int,
  banks_added int,
  banks_expired int,
  banks_renamed int,
  branches_added int,
  branches_expired int,
  branches_renamed int,
  check_findings int,
  note text,
  imported_at timestamptz not null default now(),
  imported_by text not null default 'system:bank-master-import'
);

create table if not exists public.system_bank_successors (
  id uuid primary key default gen_random_uuid(),
  old_bank_code text not null,
  old_branch_code text,
  new_bank_code text not null,
  new_branch_code text,
  effective_date date,
  note text,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (old_bank_code, old_branch_code)
);

alter table public.system_bank_datasets enable row level security;
alter table public.system_bank_successors enable row level security;

revoke all on public.system_bank_datasets from anon, authenticated;
revoke all on public.system_bank_successors from anon, authenticated;
grant select on public.system_bank_datasets to authenticated;
grant select, insert, update on public.system_bank_successors to authenticated;

drop policy if exists system_bank_datasets_select on public.system_bank_datasets;
drop policy if exists system_bank_successors_select on public.system_bank_successors;
drop policy if exists system_bank_successors_write on public.system_bank_successors;

create policy system_bank_datasets_select on public.system_bank_datasets
  for select to authenticated using (true);

create policy system_bank_successors_select on public.system_bank_successors
  for select to authenticated using (true);

create policy system_bank_successors_write on public.system_bank_successors
  for all to authenticated using (public.root_can_write()) with check (public.root_can_write());

insert into public.system_bank_datasets (
  source_date,
  source_md5,
  status,
  bank_count,
  branch_count,
  banks_added,
  banks_expired,
  banks_renamed,
  branches_added,
  branches_expired,
  branches_renamed,
  check_findings,
  note
)
select
  '2026-08-24',
  '5b96133dbdbae57337e1630ba3022bda',
  'ok',
  1146,
  28944,
  0,
  0,
  0,
  0,
  0,
  0,
  null,
  '初回投入済みの記録'
where not exists (
  select 1 from public.system_bank_datasets
  where status = 'ok' and source_md5 = '5b96133dbdbae57337e1630ba3022bda'
);
