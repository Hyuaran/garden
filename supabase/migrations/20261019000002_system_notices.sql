create table public.system_notices (
 id uuid primary key default gen_random_uuid(),
 kind text not null check (kind in ('feature','improvement','fix')),
 title text not null, body text not null, before_text text, after_text text,
 manual_href text, module text not null, visible_roles text[] not null default '{}',
 status text not null default 'draft' check (status in ('draft','published')),
 published_at timestamptz, created_at timestamptz not null default now(),
 check (kind = 'feature' or (before_text is not null and after_text is not null)),
 check (status <> 'published' or published_at is not null)
);
create table public.system_notice_reads (
 notice_id uuid not null references public.system_notices(id) on delete cascade,
 employee_id text not null references public.root_employees(employee_id) on delete cascade,
 acknowledged_at timestamptz not null default now(), primary key (notice_id, employee_id)
);
create index on public.system_notice_reads(employee_id);
create index on public.system_notices(published_at desc) where status = 'published';
create table public.system_notice_snoozes (
 employee_id text primary key references public.root_employees(employee_id) on delete cascade,
 snoozed_on date not null
);
alter table public.system_notices enable row level security;
alter table public.system_notice_reads enable row level security;
alter table public.system_notice_snoozes enable row level security;
create policy notices_read on public.system_notices for select to authenticated using (
 (status = 'published' and (cardinality(visible_roles) = 0 or exists (
 select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = any(visible_roles))))
 or (status = 'draft' and exists (select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = 'super_admin'))
);
create policy notices_publish on public.system_notices for update to authenticated
 using (exists (select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = 'super_admin'))
 with check (exists (select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.garden_role = 'super_admin'));
-- Only publication fields are writable from the browser. Service role inserts drafts.
revoke all on public.system_notices from anon, authenticated;
grant select on public.system_notices to authenticated;
grant update(status, published_at) on public.system_notices to authenticated;
grant select, insert, update, delete on public.system_notice_reads, public.system_notice_snoozes to authenticated;
create policy notice_reads_self on public.system_notice_reads for all to authenticated
 using (employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null))
 with check (employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null));
create policy notice_snoozes_self on public.system_notice_snoozes for all to authenticated
 using (employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null))
 with check (employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null));
