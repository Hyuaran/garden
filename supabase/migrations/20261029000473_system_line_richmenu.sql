alter table public.system_line_tag drop constraint system_line_tag_kind_check;
alter table public.system_line_tag add constraint system_line_tag_kind_check check(kind in ('employment','business','status','role','team','free'));
insert into public.system_line_tag(kind,name,sort) values
 ('team','宮永チーム',1),('team','小泉チーム',2),('team','石原チーム',3),('team','新人チーム',4);

create table public.system_line_contact (
 key text primary key, label text not null, url text not null default '',
 updated_at timestamptz not null default now(), updated_by text references public.root_employees(employee_id),
 check(url='' or (key='guest_home' and url ~ '^https://[^/]+') or (key<>'guest_home' and url like 'https://line.me/%'))
);
insert into public.system_line_contact(key,label,url) values
 ('miyanaga','宮永さん','https://line.me/ti/p/-xQCaOeokf'),
 ('team:小泉チーム','小泉さん','https://line.me/ti/p/gkj0hZCq83'),
 ('team:石原チーム','石原さん',''),('nhk','桐井さん',''),('office','東海林さん',''),('guest_home','会社のホームページ','');
-- Keep every Garden-created ID, including interrupted deployments. Never enumerate/delete LINE Console menus.
create table public.system_line_richmenu (
 richmenu_id text primary key, group_key text not null, created_at timestamptz not null default now(),
 active boolean not null default false, applied_at timestamptz
);
create unique index system_line_richmenu_current on public.system_line_richmenu(group_key) where active;
create table public.system_line_richmenu_assignment (
 line_user_id text primary key, richmenu_id text not null, updated_at timestamptz not null default now()
);
create table public.system_line_richmenu_lock (
 id boolean primary key default true check(id), owner uuid not null, expires_at timestamptz not null
);
do $$ declare t text; begin
 foreach t in array array['system_line_contact','system_line_richmenu','system_line_richmenu_assignment','system_line_richmenu_lock'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

create function public.system_line_menu_lock(p_owner uuid, p_release boolean default false) returns boolean
language plpgsql security definer set search_path=public as $$ begin
 if p_release then delete from system_line_richmenu_lock where owner=p_owner; return true; end if;
 insert into system_line_richmenu_lock(id,owner,expires_at) values(true,p_owner,now()+interval '30 minutes')
 on conflict(id) do update set owner=excluded.owner,expires_at=excluded.expires_at
 where system_line_richmenu_lock.expires_at<now() or system_line_richmenu_lock.owner=p_owner;
 return found;
end $$;
create function public.system_line_menu_publish(p_ids text[]) returns void
language plpgsql security definer set search_path=public as $$ begin
 update system_line_richmenu set active=false where active;
 update system_line_richmenu set active=true,applied_at=now() where richmenu_id=any(p_ids);
end $$;

-- Team choice and automatic replacement share the same transaction lock.
create function public.system_line_set_team(p_employee text, p_tag uuid) returns void
language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(29000471);
 if not exists(select 1 from system_line_tag_member m join system_line_tag t on t.id=m.tag_id
 where m.employee_id=p_employee and t.kind='business' and t.name='ブロードバンド事業') then
 raise exception 'チームはブロードバンド事業の方だけに登録できます。'; end if;
 if not exists(select 1 from system_line_tag where id=p_tag and kind='team') then raise exception 'チームを選んでください。'; end if;
 delete from system_line_tag_member where employee_id=p_employee and tag_id in(select id from system_line_tag where kind='team');
 insert into system_line_tag_member(tag_id,employee_id,source) values(p_tag,p_employee,'manual');
end $$;
create or replace function public.system_line_replace_auto(p_members jsonb) returns void
language plpgsql security definer set search_path=public as $$ begin
 perform pg_advisory_xact_lock(29000471);
 delete from system_line_tag_member where source='auto' and tag_id in(select id from system_line_tag where kind<>'team');
 insert into system_line_tag_member(tag_id,employee_id,source)
 select x.tag_id,x.employee_id,'auto' from jsonb_to_recordset(p_members) as x(tag_id uuid,employee_id text)
 join system_line_tag t on t.id=x.tag_id
 where t.kind<>'team' or (
   exists(select 1 from system_line_tag_member b join system_line_tag bt on bt.id=b.tag_id where b.employee_id=x.employee_id and bt.kind='business' and bt.name='ブロードバンド事業')
   and not exists(select 1 from system_line_tag_member m join system_line_tag mt on mt.id=m.tag_id where m.employee_id=x.employee_id and mt.kind='team')
 )
 on conflict(tag_id,employee_id) do nothing;
 -- Remove teams outside telemarketing, including former manual choices.
 delete from system_line_tag_member m using system_line_tag t where t.id=m.tag_id and t.kind='team'
 and not exists(select 1 from system_line_tag_member b join system_line_tag bt on bt.id=b.tag_id
 where b.employee_id=m.employee_id and bt.kind='business' and bt.name='ブロードバンド事業');
 insert into system_line_tag_member(tag_id,employee_id,source)
 select t.id,e.employee_id,'auto' from root_employees e cross join system_line_tag t
 where t.kind='team' and t.name='新人チーム' and e.employment_type='アルバイト' and e.deleted_at is null
 and exists(select 1 from system_line_tag_member b join system_line_tag bt on bt.id=b.tag_id where b.employee_id=e.employee_id and bt.kind='business' and bt.name='ブロードバンド事業')
 and not exists(select 1 from system_line_tag_member m join system_line_tag mt on mt.id=m.tag_id where m.employee_id=e.employee_id and mt.kind='team')
 on conflict do nothing;
end $$;
revoke all on function public.system_line_menu_lock(uuid,boolean), public.system_line_menu_publish(text[]), public.system_line_set_team(text,uuid) from public,anon,authenticated;
grant execute on function public.system_line_menu_lock(uuid,boolean), public.system_line_menu_publish(text[]), public.system_line_set_team(text,uuid) to service_role;
