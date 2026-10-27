begin;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('root-minimum-wages','','最低賃金マスタ',array['manager','admin','super_admin']::text[]);
create table public.root_minimum_wages (
 id uuid primary key default gen_random_uuid(),
 prefecture text not null check (length(trim(prefecture)) > 0),
 hourly_amount integer not null check (hourly_amount > 0),
 effective_from date not null,
 source_url text,
 created_by text not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(prefecture,effective_from)
);
alter table public.root_minimum_wages enable row level security;
create policy minimum_wages_read on public.root_minimum_wages for select to authenticated using (exists(select 1 from public.root_employees e where e.user_id=auth.uid() and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>=current_date)));
create policy minimum_wages_insert on public.root_minimum_wages for insert to authenticated with check (exists(select 1 from public.root_employees e where e.user_id=auth.uid() and e.garden_role='super_admin' and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>=current_date)));
create policy minimum_wages_update on public.root_minimum_wages for update to authenticated using (exists(select 1 from public.root_employees e where e.user_id=auth.uid() and e.garden_role='super_admin' and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>=current_date))) with check (exists(select 1 from public.root_employees e where e.user_id=auth.uid() and e.garden_role='super_admin' and e.is_active and e.deleted_at is null and (e.termination_date is null or e.termination_date>=current_date)));
grant select,insert,update on public.root_minimum_wages to authenticated;
grant all on public.root_minimum_wages to service_role;
create function public.touch_minimum_wage() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger minimum_wages_touch before update on public.root_minimum_wages for each row execute function public.touch_minimum_wage();
insert into public.root_minimum_wages(prefecture,hourly_amount,effective_from,source_url,created_by) values
 ('大阪府',1177,'2025-10-16',null,'初期登録'),
 ('大阪府',1231,'2026-10-01','https://www.rengo-osaka.gr.jp/info/saitei_chingin.html','初期登録');
create table public.root_minimum_wage_sync_log (id text primary key, last_error text, updated_at timestamptz not null default now());
alter table public.root_minimum_wage_sync_log enable row level security;
revoke all on public.root_minimum_wage_sync_log from anon,authenticated;
grant all on public.root_minimum_wage_sync_log to service_role;
commit;
