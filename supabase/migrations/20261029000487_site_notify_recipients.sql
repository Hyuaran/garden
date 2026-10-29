-- 作成のみ。cron 0 回/日。画面表示時 1 回、お問い合わせごと 1 回。
create table public.system_site_notify_recipients (
 site_key text not null,
 employee_id text not null references public.root_employees(employee_id),
 registration_order bigint generated always as identity,
 updated_at timestamptz not null default now(), updated_by text,
 primary key(site_key,employee_id)
);
alter table public.system_site_notify_recipients enable row level security;
revoke all on public.system_site_notify_recipients from public,anon,authenticated;
grant all on public.system_site_notify_recipients to service_role;
grant usage,select on sequence public.system_site_notify_recipients_registration_order_seq to service_role;
create policy service_only on public.system_site_notify_recipients for all to service_role using(true) with check(true);
do $$
declare r record; matched text; matches integer;
begin
 for r in select * from (values ('hyuaran-company','金亜奈',0),
('hyuaran-company','東海林美琴',1),
('hyuaran-recruit','金亜奈',0),
('centerrise-company','上田基人',0),
('centerrise-company','石原孝志朗',1),
('arata-company','上田基人',0),
('arata-company','石原孝志朗',1),
('link-support-subsidy','上田基人',0),
('link-support-subsidy','石原孝志朗',1),
('link-support-company','上田基人',0),
('link-support-company','石原孝志朗',1),
('taiyou-company','上田基人',0),
('taiyou-company','石原孝志朗',1),
('taiyou-alliance','上田基人',0),
('taiyou-alliance','石原孝志朗',1),
('taiyou-just-hikari','上田基人',0),
('taiyou-just-hikari','宮永ひかり',1),
('taiyou-just-hikari','小泉翔',2),
('taiyou-just-hikari','石原孝志朗',3),
('ichi-company','上田基人',0),
('ichi-company','石原孝志朗',1),
('ichi-hikari','上田基人',0),
('ichi-hikari','宮永ひかり',1),
('ichi-hikari','小泉翔',2),
('ichi-hikari','石原孝志朗',3),
('stonebase-company','東海林美琴',0)) as seed(site_key,name,position) order by site_key,position loop
 select min(employee_id),count(*) into matched,matches from public.root_employees e
 where regexp_replace(e.name,'[[:space:]　]+','','g')=regexp_replace(r.name,'[[:space:]　]+','','g') and is_active=true and deleted_at is null;
 if matches=1 then
 insert into public.system_site_notify_recipients(site_key,employee_id) values(r.site_key,matched) on conflict do nothing;
 else raise notice 'site notify: % / % matched % employees; skipped',r.site_key,r.name,matches;
 end if;
 end loop;
end $$;
create function public.replace_site_notify_recipients(p_site_key text,p_employee_ids text[],p_updated_by text)
returns void language plpgsql set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_site_key,487));
 if exists(select 1 from unnest(p_employee_ids) id where not exists(
 select 1 from root_employees e where e.employee_id=id and e.is_active=true and e.deleted_at is null
 and (e.termination_date is null or e.termination_date>(now() at time zone 'Asia/Tokyo')::date)
 and nullif(btrim(e.chatwork_account_id),'') is not null)) then raise exception 'Invalid recipient'; end if;
 delete from system_site_notify_recipients where site_key=p_site_key;
 insert into system_site_notify_recipients(site_key,employee_id,updated_by)
 select p_site_key,id,p_updated_by from unnest(p_employee_ids) with ordinality as chosen(id,position) order by position;
end $$;
revoke all on function public.replace_site_notify_recipients(text,text[],text) from public,anon,authenticated;
grant execute on function public.replace_site_notify_recipients(text,text[],text) to service_role;
