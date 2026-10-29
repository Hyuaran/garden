begin;
-- Keep the confirmed manual tags until the one-off import has fully succeeded.
create table public.root_team_import_state (id boolean primary key default true check(id), ready boolean not null default false);
insert into public.root_team_import_state(id) values(true);
alter table public.root_team_import_state enable row level security;
revoke all on public.root_team_import_state from public,anon,authenticated;
grant all on public.root_team_import_state to service_role;
alter table public.root_employees add column business text check (business in ('ブロードバンド事業','NHK派遣事業','関西電力事業'));
create table public.root_employee_team_history (
 id uuid primary key default gen_random_uuid(),
 employee_id text not null references public.root_employees(employee_id),
 effective_date date not null,
 team text not null check(team in ('宮永チーム','小泉チーム','石原チーム','新人チーム','バックヤード','所属なし')),
 memo text, entered_by text not null, entered_at timestamptz not null default now(),
 source text not null check(source in ('garden','kintone')),
 source_ref text unique
);
create index on public.root_employee_team_history(employee_id,effective_date desc,entered_at desc,id desc);
alter table public.root_employee_team_history enable row level security;
revoke all on public.root_employee_team_history from public,anon,authenticated;
grant all on public.root_employee_team_history to service_role;
grant select,insert,update,delete on public.root_employee_team_history to authenticated;
create policy team_history_read on public.root_employee_team_history for select to authenticated using (public.root_can_access());
create policy team_history_insert on public.root_employee_team_history for insert to authenticated with check (public.root_can_write() and source='garden' and entered_by=(select employee_id from public.root_employees where user_id=auth.uid() limit 1));
create policy team_history_update on public.root_employee_team_history for update to authenticated using (public.root_can_write() and source='garden') with check (public.root_can_write() and source='garden');
create policy team_history_delete on public.root_employee_team_history for delete to authenticated using (public.root_can_write() and source='garden');
create function public.root_guard_imported_team() returns trigger language plpgsql set search_path=public as $$
begin
 if old.source='kintone' then raise exception 'Kintone から取り込んだ行です'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.source<>old.source or new.employee_id<>old.employee_id or new.source_ref is distinct from old.source_ref then raise exception '所属履歴の出どころは変更できません'; end if;
 return new;
end $$;
create trigger root_guard_imported_team before update or delete on public.root_employee_team_history for each row execute function public.root_guard_imported_team();
create function public.root_current_team(p_employee_id text, on_date date default (now() at time zone 'Asia/Tokyo')::date) returns text language sql stable security invoker set search_path=public as $$
 select team from root_employee_team_history where employee_id=p_employee_id and effective_date<=on_date order by effective_date desc,entered_at desc,id desc limit 1
$$;
revoke all on function public.root_current_team(text,date) from public,anon;
grant execute on function public.root_current_team(text,date) to authenticated,service_role;
create view public.root_employees_with_team with (security_invoker=true) as select e.*,public.root_current_team(e.employee_id) as current_team from public.root_employees e;
grant select on public.root_employees_with_team to service_role;
create function public.root_record_business() returns trigger language plpgsql set search_path=public as $$
begin
 if (tg_op='INSERT' and new.business is not null) or (tg_op='UPDATE' and new.business is distinct from old.business) then
  insert into root_employee_profile_history(employee_id,category,payload,source,recorded_by,effective_from)
  values(new.employee_id,'employment',coalesce((select payload from root_employee_profile_history where employee_id=new.employee_id and category='employment' order by recorded_at desc,id desc limit 1),'{}'::jsonb)||jsonb_build_object('business',new.business),'admin',coalesce((select employee_id from root_employees where user_id=auth.uid() limit 1),'garden'),(now() at time zone 'Asia/Tokyo')::date);
 end if;
 return new;
end $$;
create trigger root_record_business after insert or update of business on public.root_employees for each row execute function public.root_record_business();
-- Scoped replacement also supports event-driven updates of one employee.
create or replace function public.system_line_replace_auto(p_members jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29000471);
 if not exists(select 1 from root_team_import_state where ready) then return; end if;
 delete from system_line_tag_member m using system_line_tag t where t.id=m.tag_id and (m.source='auto' or t.kind in ('business','team'));
 insert into system_line_tag_member(tag_id,employee_id,source)
 select x.tag_id,x.employee_id,'auto' from jsonb_to_recordset(p_members) x(tag_id uuid,employee_id text) on conflict(tag_id,employee_id) do update set source='auto';
end $$;
create function public.system_line_replace_employee_auto(p_employee text,p_members jsonb) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(29000471);
 if not exists(select 1 from root_team_import_state where ready) then return; end if;
 delete from system_line_tag_member m using system_line_tag t where t.id=m.tag_id and m.employee_id=p_employee and (m.source='auto' or t.kind in ('business','team'));
 insert into system_line_tag_member(tag_id,employee_id,source)
 select x.tag_id,p_employee,'auto' from jsonb_to_recordset(p_members) x(tag_id uuid,employee_id text) where x.employee_id=p_employee on conflict(tag_id,employee_id) do update set source='auto';
end $$;
revoke all on function public.system_line_replace_employee_auto(text,jsonb) from public,anon,authenticated;
grant execute on function public.system_line_replace_employee_auto(text,jsonb) to service_role;
commit;
