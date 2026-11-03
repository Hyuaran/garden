-- RLS有効・ポリシーなし。サーバー管理者接続のみ。
begin;
create table public.system_shift_wish (
 employee_id text references public.root_employees(employee_id) not null,
 work_date date not null, start_time time,
 updated_at timestamptz not null default now(), updated_by text references public.root_employees(employee_id),
 primary key(employee_id,work_date), check(start_time is null or (start_time between time '10:00' and time '18:00' and extract(minute from start_time) in (0,30) and extract(second from start_time)=0))
);
create table public.system_shift_submission (
 employee_id text references public.root_employees(employee_id) not null,
 year_month text not null check(year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 submitted_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by text references public.root_employees(employee_id), primary key(employee_id,year_month)
);
create table public.system_shift_confirmed (
 employee_id text references public.root_employees(employee_id) not null,
 work_date date not null, start_time time, end_time time,
 updated_at timestamptz not null default now(), updated_by text references public.root_employees(employee_id),
 primary key(employee_id,work_date), check((start_time is null and end_time is null) or (start_time is not null and end_time is not null and end_time=time '21:00' and start_time between time '10:00' and time '18:00' and extract(minute from start_time) in (0,30) and extract(second from start_time)=0))
);
create table public.system_shift_month (year_month text primary key check(year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'), confirmed_at timestamptz, confirmed_by text references public.root_employees(employee_id), confirmed_by_name text);
alter table public.system_shift_wish enable row level security;
alter table public.system_shift_submission enable row level security;
alter table public.system_shift_confirmed enable row level security;
alter table public.system_shift_month enable row level security;

create function public.save_shift_person(p_employee text,p_month text,p_rows jsonb,p_actor text,p_submit boolean) returns void language plpgsql set search_path=public as $$
declare target_confirmed boolean;
begin
 perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
 if p_submit and (p_month <> to_char((now() at time zone 'Asia/Tokyo') + interval '1 month','YYYY-MM') or now() >= (((p_month||'-01')::date - interval '1 month' + interval '15 days') at time zone 'Asia/Tokyo')) then
  raise exception '提出の締切を過ぎました。変更は責任者に連絡してください。';
 end if;
 select exists(select 1 from system_shift_month where year_month=p_month and confirmed_at is not null) into target_confirmed;
 if target_confirmed and not p_submit then
 insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,updated_by)
 select p_employee,(r->>'work_date')::date,case when (r->>'work_date') in (select jsonb_array_elements_text(to_jsonb(holidays)) from system_kanri_month_setting where year_month=p_month) then null else (r->>'start_time')::time end,
 case when r->>'start_time' is null or (r->>'work_date') in (select jsonb_array_elements_text(to_jsonb(holidays)) from system_kanri_month_setting where year_month=p_month) then null else time '21:00' end,p_actor from jsonb_array_elements(p_rows) r
 on conflict(employee_id,work_date) do update set start_time=excluded.start_time,end_time=excluded.end_time,updated_at=now(),updated_by=p_actor;
 else
 insert into system_shift_wish(employee_id,work_date,start_time,updated_by) select p_employee,(r->>'work_date')::date,(r->>'start_time')::time,p_actor from jsonb_array_elements(p_rows) r
 on conflict(employee_id,work_date) do update set start_time=excluded.start_time,updated_at=now(),updated_by=p_actor;
 end if;
 if p_submit then
 insert into system_shift_submission(employee_id,year_month,updated_by) values(p_employee,p_month,p_actor) on conflict(employee_id,year_month) do update set submitted_at=now(),updated_at=now(),updated_by=p_actor;
 end if;
end $$;
create function public.toggle_shift_holiday(p_month text,p_date text,p_actor uuid) returns void language plpgsql set search_path=public as $$
declare dates jsonb;
begin
 perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
 select to_jsonb(holidays) into dates from system_kanri_month_setting where year_month=p_month;
 dates:=coalesce(dates,'[]'::jsonb);
 if dates ? p_date then dates:=dates-p_date; else dates:=dates||to_jsonb(p_date);end if;
 insert into system_kanri_month_setting(year_month,holidays,updated_by,updated_at) values(p_month,array(select value::date from jsonb_array_elements_text(dates)),p_actor,now()) on conflict(year_month) do update set holidays=excluded.holidays,updated_by=p_actor,updated_at=now();
end $$;
create function public.confirm_shift_month(p_month text,p_people text[],p_actor text,p_name text) returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
 delete from system_shift_confirmed where to_char(work_date,'YYYY-MM')=p_month;
 insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,updated_by)
 select e,d::date,case when coalesce(to_jsonb(s.holidays),'[]'::jsonb) ? to_char(d,'YYYY-MM-DD') then null else w.start_time end,
 case when w.start_time is null or coalesce(to_jsonb(s.holidays),'[]'::jsonb) ? to_char(d,'YYYY-MM-DD') then null else time '21:00' end,p_actor
 from unnest(p_people) e cross join generate_series((p_month||'-01')::date,((p_month||'-01')::date+interval '1 month - 1 day')::date,interval '1 day') d
 left join system_shift_wish w on w.employee_id=e and w.work_date=d::date left join system_kanri_month_setting s on s.year_month=p_month;
 insert into system_shift_month values(p_month,now(),p_actor,p_name) on conflict(year_month) do update set confirmed_at=now(),confirmed_by=p_actor,confirmed_by_name=p_name;
end $$;
revoke all on function public.save_shift_person(text,text,jsonb,text,boolean),public.toggle_shift_holiday(text,text,uuid),public.confirm_shift_month(text,text[],text,text) from public,anon,authenticated;
grant execute on function public.save_shift_person(text,text,jsonb,text,boolean),public.toggle_shift_holiday(text,text,uuid),public.confirm_shift_month(text,text[],text,text) to service_role;
-- 管理表側で定休日を変更した場合も、確定済みの該当日は休みにする。
create function public.apply_shift_holidays() returns trigger language plpgsql set search_path=public as $$
begin
 -- 管理表側は月のアドバイザリロックを取らないため、確定表の書き込みと直列化する。
 lock table system_shift_confirmed in share row exclusive mode;
 update system_shift_confirmed set start_time=null,end_time=null,updated_at=now(),updated_by=(select employee_id from root_employees where user_id=new.updated_by limit 1)
 where to_char(work_date,'YYYY-MM')=new.year_month and work_date=any(new.holidays) and start_time is not null;
 return new;
end $$;
revoke all on function public.apply_shift_holidays() from public,anon,authenticated;
create trigger system_shift_apply_holidays after insert or update of holidays on public.system_kanri_month_setting for each row execute function public.apply_shift_holidays();
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
('system-shift','mine','シフト：自分のシフト',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
('system-shift','team','シフト：みんなのシフト',array['manager','admin','super_admin']::text[])
on conflict(page_key,tab_key) do update set label=excluded.label,default_roles=excluded.default_roles;

-- 検索カタログの追加。元の表のRLSを維持し、管理者接続だけで検索する。
/* $catalog$[{"table":"system_shift_month","fields":[{"path":["year_month"],"phone":false},{"path":["confirmed_by_name"],"phone":false}]}]$catalog$ */
create view public.search_v_system_shift_month with (security_invoker=true) as
 select t.*,public.garden_search_join(public.search_norm(t.year_month,false),public.search_norm(t.confirmed_by_name,false)) as search_text from public.system_shift_month t;
revoke all on public.search_v_system_shift_month from public,anon,authenticated;
grant select on public.search_v_system_shift_month to service_role;
create index system_shift_month_search_trgm_idx on public.system_shift_month using gin ((public.garden_search_join(public.search_norm(year_month,false),public.search_norm(confirmed_by_name,false))) public.gin_trgm_ops);
commit;
