begin;
create table public.system_filemaker_account_requests (
 id uuid primary key default gen_random_uuid(),
 hire_candidate_id uuid not null unique references public.system_hire_candidates(id) on delete cascade,
 employee_id text references public.root_employees(employee_id),
 account_name text not null,
 files jsonb not null default '{}'::jsonb,
 status text not null default 'waiting' check (status in ('waiting','sent','done','failed')),
 failure_notified_at timestamptz, stuck_notified_at timestamptz, requested_by text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.system_filemaker_account_requests enable row level security;
create policy filemaker_accounts_select on public.system_filemaker_account_requests
 for select to authenticated using (public.root_is_super_admin());
revoke all on public.system_filemaker_account_requests from anon, authenticated;
grant select on public.system_filemaker_account_requests to authenticated;
grant all on public.system_filemaker_account_requests to service_role;
create index filemaker_accounts_pending on public.system_filemaker_account_requests(status,updated_at)
 where status in ('waiting','sent');
commit;
