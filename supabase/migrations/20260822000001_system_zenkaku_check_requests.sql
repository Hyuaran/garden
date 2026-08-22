-- Apply manually in Supabase SQL Editor. This migration creates one small queue table,
-- its RLS policies, and an atomic service-role claim function. Expected: under 1 minute;
-- only short metadata locks are taken while creating new objects.

create table if not exists public.system_zenkaku_check_request (
  id uuid primary key default gen_random_uuid(),
  sales_id text not null check (char_length(btrim(sales_id)) between 1 and 100),
  requested_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','reading','done','failed')),
  result jsonb,
  error_code text check (error_code is null or error_code in ('not_found','fm_unreachable','timeout','invalid_payload','internal_error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_zenkaku_request_queue
  on public.system_zenkaku_check_request(status, created_at);
create index if not exists idx_system_zenkaku_request_owner
  on public.system_zenkaku_check_request(requested_by, created_at desc);

alter table public.system_zenkaku_check_request enable row level security;

drop policy if exists system_zenkaku_request_insert_own on public.system_zenkaku_check_request;
create policy system_zenkaku_request_insert_own on public.system_zenkaku_check_request
  for insert to authenticated with check (requested_by = auth.uid());

drop policy if exists system_zenkaku_request_select_own_or_manager on public.system_zenkaku_check_request;
create policy system_zenkaku_request_select_own_or_manager on public.system_zenkaku_check_request
  for select to authenticated using (
    requested_by = auth.uid()
    or public.has_role_at_least('manager')
  );

grant select, insert on public.system_zenkaku_check_request to authenticated;
grant all on public.system_zenkaku_check_request to service_role;

create or replace function public.system_zenkaku_claim_next()
returns table(id uuid, sales_id text)
language plpgsql security definer set search_path = public
as $$
begin
  update public.system_zenkaku_check_request
     set status = 'failed', error_code = 'timeout', updated_at = now()
   where status = 'reading' and updated_at < now() - interval '60 seconds';

  return query
  with candidate as (
    select r.id from public.system_zenkaku_check_request r
     where r.status = 'pending' order by r.created_at
     for update skip locked limit 1
  )
  update public.system_zenkaku_check_request r
     set status = 'reading', updated_at = now()
    from candidate c where r.id = c.id
  returning r.id, r.sales_id;
end;
$$;

revoke all on function public.system_zenkaku_claim_next() from public, anon, authenticated;
grant execute on function public.system_zenkaku_claim_next() to service_role;

comment on table public.system_zenkaku_check_request is
  'Short-lived FileMaker check queue. Stores only sales ID, state, error code, and Garden-check findings; never source master data.';
comment on column public.system_zenkaku_check_request.result is
  'GardenCheckResult findings only. Raw FileMaker names, addresses, phone numbers, and other source fields must never be stored.';
