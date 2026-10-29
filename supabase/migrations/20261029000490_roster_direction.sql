begin;
create table public.root_roster_settings (
 id boolean primary key default true check(id),
 direction text not null default 'kintone_to_garden' check(direction in ('kintone_to_garden','garden_to_kintone')),
 switched_at timestamptz, switched_by text
);
insert into public.root_roster_settings(id) values(true);
create table public.root_roster_push_queue (
 id uuid primary key default gen_random_uuid(), employee_id text not null references public.root_employees(employee_id),
 reason text not null, status text not null check(status in ('pending','held','done','failed')),
 attempts int not null default 0, last_error text, requested_at timestamptz not null default now(), done_at timestamptz,
 lease_until timestamptz
);
create unique index root_roster_push_one_open on public.root_roster_push_queue(employee_id) where status in ('pending','held');
alter table public.root_roster_settings enable row level security;
alter table public.root_roster_push_queue enable row level security;
revoke all on public.root_roster_settings,public.root_roster_push_queue from public,anon,authenticated;
grant all on public.root_roster_settings,public.root_roster_push_queue to service_role;
create function public.root_enqueue_roster_push(p_employee_id text,p_reason text,p_status text) returns uuid
language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_employee_id,490));
 update root_roster_push_queue set reason=p_reason,status=p_status,requested_at=clock_timestamp(),attempts=0,last_error=null
 where employee_id=p_employee_id and status in ('pending','held') returning id into result;
 if result is null then
  insert into root_roster_push_queue(employee_id,reason,status) values(p_employee_id,p_reason,p_status) returning id into result;
 end if;
 return result;
end $$;
revoke all on function public.root_enqueue_roster_push(text,text,text) from public,anon,authenticated;
grant execute on function public.root_enqueue_roster_push(text,text,text) to service_role;
-- A save and the morning retry must not send the same person's older values in parallel.
create function public.root_claim_roster_push(p_id uuid) returns boolean
language sql security invoker set search_path=public as $$
 with claimed as (
  update root_roster_push_queue set lease_until=now()+interval '5 minutes'
  where id=p_id and status in ('pending','held') and (lease_until is null or lease_until<now()) returning id
 ) select exists(select 1 from claimed)
$$;
revoke all on function public.root_claim_roster_push(uuid) from public,anon,authenticated;
grant execute on function public.root_claim_roster_push(uuid) to service_role;
commit;
