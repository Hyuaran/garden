begin;
create table public.bud_bb_viewers (
 id smallint primary key default 1 check (id=1),
 employee_ids text[] not null default '{}',
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id)
);
insert into public.bud_bb_viewers(employee_ids) values (array['EMP-0000','EMP-0004','EMP-0008']);
alter table public.bud_bb_viewers enable row level security;
create policy bb_viewers_read on public.bud_bb_viewers for select to authenticated using (public.bud_has_access());
revoke all on public.bud_bb_viewers from anon,authenticated;
grant select on public.bud_bb_viewers to authenticated;
grant all on public.bud_bb_viewers to service_role;

create function public.bud_bb_can_view() returns boolean
language sql security definer stable set search_path=public as $$
 select public.bud_has_access() and (public.bud_is_super_admin() or exists (
  select 1 from public.root_employees e cross join public.bud_bb_viewers v
  where v.id=1 and e.user_id=auth.uid() and e.employee_id=any(v.employee_ids)
   and e.is_active=true and e.deleted_at is null
   and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
  ));
$$;
revoke all on function public.bud_bb_can_view() from public,anon,authenticated;
grant execute on function public.bud_bb_can_view() to authenticated;

-- Covers bb_admin_read on settings/records/payee_rules/recon_issues and
-- bud_bb_agent_details_read, plus any other existing role-based SELECT policy.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies
  where schemaname='public' and left(tablename,7)='bud_bb_' and cmd='SELECT'
   and (policyname in ('bb_admin_read','bud_bb_agent_details_read') or qual like '%bud_is_admin_or_super_admin%')
 loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  execute format('create policy %I on public.%I for select to authenticated using (public.bud_bb_can_view())',p.policyname,p.tablename);
 end loop;
end $$;

create function public.bud_bb_save_viewers(p_viewers text[]) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 if p_viewers is null or cardinality(p_viewers)>2000 then raise exception 'invalid viewers'; end if;
 if exists (select 1 from unnest(p_viewers) v where not exists (
  select 1 from public.root_employees e where e.employee_id=v and e.is_active=true and e.deleted_at is null
   and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
 )) then raise exception 'invalid employee'; end if;
 update public.bud_bb_viewers set employee_ids=array(select distinct v from unnest(p_viewers) v),updated_at=now(),updated_by=auth.uid() where id=1;
 if not found then raise exception 'viewers missing'; end if;
end $$;
revoke all on function public.bud_bb_save_viewers(text[]) from public,anon,authenticated;
grant execute on function public.bud_bb_save_viewers(text[]) to authenticated;
commit;
