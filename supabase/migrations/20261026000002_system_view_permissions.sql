-- 作成のみ。本番への適用は人間側で行う。
create table public.system_view_permissions (
 page_key text not null, tab_key text not null default '', roles text[] not null default '{}',
 employee_ids text[] not null default '{}', viewers_can_add boolean not null default false,
 updated_by text not null, updated_at timestamptz not null default now(), primary key(page_key,tab_key)
);
create table public.system_view_permission_logs (
 id bigint generated always as identity primary key, page_key text not null, tab_key text not null,
 action text not null, actor_employee_id text not null, changed_at timestamptz not null default now(),
 before_value jsonb, after_value jsonb
);
alter table public.system_view_permissions enable row level security;
alter table public.system_view_permission_logs enable row level security;
revoke all on public.system_view_permissions, public.system_view_permission_logs from anon, authenticated;
grant select on public.system_view_permissions, public.system_view_permission_logs to authenticated;
create policy view_permissions_read on public.system_view_permissions for select to authenticated using (auth.uid() is not null);
-- 変更の記録は全権管理者だけが読む（2026-10-26 Claude 確認時に変更）
create policy view_permission_logs_read on public.system_view_permission_logs for select to authenticated using (public.root_is_super_admin());

-- 既定値は permission-registry.ts の入社手続きと同じ。ほかの画面を適用するときに追加する。
create function public.system_view_default_roles(p_page text,p_tab text) returns text[] language plpgsql immutable set search_path=public as $$
begin
 if p_page <> 'system-onboarding' or p_tab not in ('','self','candidates','confirmations','all') then raise exception 'unknown scope' using errcode='22023'; end if;
 return case when p_tab in ('','self') then array['super_admin','admin','manager','staff','cs','toss','closer','outsource'] when p_tab='all' then array['super_admin','admin','manager'] else array['super_admin'] end;
end $$;

-- 変更は同じ画面単位で直列化し、追加と保存・継承元の変更の競合を防ぐ。
create function public.system_save_view_permission(p_page text,p_tab text,p_roles text[],p_employee_ids text[],p_viewers_can_add boolean) returns void
language plpgsql security definer set search_path=public as $$
declare actor public.root_employees%rowtype; old_value jsonb; new_value jsonb;
begin
 perform public.system_view_default_roles(p_page,p_tab);
 select * into actor from public.root_employees where user_id=auth.uid() and is_active and deleted_at is null and (termination_date is null or termination_date>(now() at time zone 'Asia/Tokyo')::date) limit 1;
 if actor.garden_role is distinct from 'super_admin' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_roles is null or p_employee_ids is null or p_viewers_can_add is null or not p_roles <@ array['super_admin','admin','manager','staff','cs','toss','closer','outsource'] or cardinality(p_employee_ids)>2000 then raise exception 'invalid settings' using errcode='22023'; end if;
 if exists (select 1 from unnest(p_employee_ids) id where not exists(select 1 from public.root_employees e where e.employee_id=id and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>(now() at time zone 'Asia/Tokyo')::date))) then raise exception 'inactive employee' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('system-view:'||p_page,0));
 select to_jsonb(v) into old_value from public.system_view_permissions v where page_key=p_page and tab_key=p_tab;
 insert into public.system_view_permissions values(p_page,p_tab,array(select distinct unnest(p_roles||array['super_admin'])),array(select distinct unnest(p_employee_ids)),p_viewers_can_add,actor.employee_id,now())
 on conflict(page_key,tab_key) do update set roles=excluded.roles,employee_ids=excluded.employee_ids,viewers_can_add=excluded.viewers_can_add,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 select to_jsonb(v) into new_value from public.system_view_permissions v where page_key=p_page and tab_key=p_tab;
 insert into public.system_view_permission_logs(page_key,tab_key,action,actor_employee_id,before_value,after_value) values(p_page,p_tab,'save',actor.employee_id,old_value,new_value);
end $$;
create function public.system_reset_view_permission(p_page text,p_tab text) returns void language plpgsql security definer set search_path=public as $$
declare actor public.root_employees%rowtype; old_value jsonb;
begin
 perform public.system_view_default_roles(p_page,p_tab);
 select * into actor from public.root_employees where user_id=auth.uid() and is_active and deleted_at is null and (termination_date is null or termination_date>(now() at time zone 'Asia/Tokyo')::date) limit 1;
 if actor.garden_role is distinct from 'super_admin' then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('system-view:'||p_page,0));
 select to_jsonb(v) into old_value from public.system_view_permissions v where page_key=p_page and tab_key=p_tab;
 delete from public.system_view_permissions where page_key=p_page and tab_key=p_tab;
 insert into public.system_view_permission_logs(page_key,tab_key,action,actor_employee_id,before_value,after_value) values(p_page,p_tab,'reset',actor.employee_id,old_value,null);
end $$;
create function public.system_add_viewer(p_page text,p_tab text,p_employee_id text) returns boolean language plpgsql security definer set search_path=public as $$
declare actor public.root_employees%rowtype; setting public.system_view_permissions%rowtype; old_value jsonb; new_value jsonb;
begin
 perform public.system_view_default_roles(p_page,p_tab);
 select * into actor from public.root_employees where user_id=auth.uid() and is_active and deleted_at is null and (termination_date is null or termination_date>(now() at time zone 'Asia/Tokyo')::date) limit 1;
 if actor.employee_id is null then raise exception 'forbidden' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('system-view:'||p_page,0));
 select * into setting from public.system_view_permissions where page_key=p_page and tab_key in (p_tab,'') order by (tab_key=p_tab) desc limit 1;
 if actor.garden_role is distinct from 'super_admin' and (setting.page_key is null or not setting.viewers_can_add or not (coalesce(actor.garden_role=any(setting.roles),false) or actor.employee_id=any(setting.employee_ids))) then raise exception 'forbidden' using errcode='42501'; end if;
 if not exists(select 1 from public.root_employees e where e.employee_id=p_employee_id and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>(now() at time zone 'Asia/Tokyo')::date)) then raise exception 'inactive employee' using errcode='22023'; end if;
 if p_employee_id=any(coalesce(setting.employee_ids,'{}')) then return false; end if;
 select to_jsonb(v) into old_value from public.system_view_permissions v where page_key=p_page and tab_key=p_tab;
 insert into public.system_view_permissions values(p_page,p_tab,coalesce(setting.roles,public.system_view_default_roles(p_page,p_tab)),coalesce(setting.employee_ids,'{}')||array[p_employee_id],coalesce(setting.viewers_can_add,false),actor.employee_id,now())
 on conflict(page_key,tab_key) do update set employee_ids=excluded.employee_ids,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
 select to_jsonb(v) into new_value from public.system_view_permissions v where page_key=p_page and tab_key=p_tab;
 insert into public.system_view_permission_logs(page_key,tab_key,action,actor_employee_id,before_value,after_value) values(p_page,p_tab,'add',actor.employee_id,old_value,new_value);
 return true;
end $$;
revoke all on function public.system_view_default_roles(text,text), public.system_save_view_permission(text,text,text[],text[],boolean), public.system_reset_view_permission(text,text), public.system_add_viewer(text,text,text) from public,anon,authenticated;
grant execute on function public.system_save_view_permission(text,text,text[],text[],boolean), public.system_reset_view_permission(text,text), public.system_add_viewer(text,text,text) to authenticated;
