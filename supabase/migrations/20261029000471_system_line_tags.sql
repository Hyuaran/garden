create table public.system_line_tag (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('employment','business','status','role','free')),
 name text not null check(length(name) between 1 and 100), sort integer not null default 0, created_at timestamptz not null default now(), unique(kind,name)
);
create table public.system_line_tag_member (
 tag_id uuid references public.system_line_tag on delete cascade, employee_id text references public.root_employees(employee_id) on delete cascade,
 source text not null check(source in ('auto','manual')), created_at timestamptz not null default now(), primary key(tag_id,employee_id)
);
create table public.system_line_greeting (
 id uuid primary key default gen_random_uuid(), employment_tag_id uuid references public.system_line_tag on delete restrict,
 business_tag_id uuid references public.system_line_tag on delete restrict, body text not null check(length(body) between 1 and 5000),
 enabled boolean not null default true, updated_at timestamptz not null default now(), updated_by text references public.root_employees(employee_id),
 check(business_tag_id is null or employment_tag_id is not null)
);
create unique index system_line_greeting_scope on public.system_line_greeting(coalesce(employment_tag_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(business_tag_id,'00000000-0000-0000-0000-000000000000'::uuid));
create table public.system_line_broadcast (
 id uuid primary key default gen_random_uuid(), title text not null, body text not null, tag_ids uuid[] not null default '{}',
 recipient_count integer not null, sent_count integer not null default 0, failed_count integer not null default 0,
 created_by text references public.root_employees(employee_id), created_at timestamptz not null default now(), sent_at timestamptz
);
do $$ declare t text; begin
 foreach t in array array['system_line_tag','system_line_tag_member','system_line_greeting','system_line_broadcast'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select, insert, update, delete on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy super_admin_only on public.%I for all to authenticated using (exists(select 1 from public.root_employees where user_id=auth.uid() and garden_role=''super_admin'' and is_active and deleted_at is null and (termination_date is null or termination_date > (now() at time zone ''Asia/Tokyo'')::date))) with check (exists(select 1 from public.root_employees where user_id=auth.uid() and garden_role=''super_admin'' and is_active and deleted_at is null and (termination_date is null or termination_date > (now() at time zone ''Asia/Tokyo'')::date)))',t);
 end loop;
end $$;
insert into public.system_line_tag(kind,name,sort) values
 ('employment','正社員',1),('employment','アルバイト',2),('employment','業務委託',3),
 ('business','ブロードバンド事業',1),('business','NHK派遣事業',2),
 ('status','入社予定',1),('status','在籍中',2),('status','退職',3),
 ('role','トス',1),('role','クローザー',2),('role','CS',3),('role','事務',4);
insert into public.system_line_greeting(body) values (E'{名前}さん\nはじめまして！official｜通知です。\n友だち追加ありがとうございます。\n\nこのアカウントでは、勤務に関する連絡や周知をお送りします。\n通知は「オン」にしておいてください。');
-- Atomic replacement, serialized across page loads; manual memberships survive.
create function public.system_line_replace_auto(p_members jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(29000471);
 delete from system_line_tag_member where source='auto';
 insert into system_line_tag_member(tag_id,employee_id,source)
 select x.tag_id,x.employee_id,'auto' from jsonb_to_recordset(p_members) as x(tag_id uuid,employee_id text)
 on conflict(tag_id,employee_id) do nothing;
end $$;
revoke all on function public.system_line_replace_auto(jsonb) from public,anon,authenticated;
grant execute on function public.system_line_replace_auto(jsonb) to service_role;
