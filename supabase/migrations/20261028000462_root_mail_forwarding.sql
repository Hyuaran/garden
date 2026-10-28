-- 作成のみ。適用・定期実行の有効化は別途行う。初期データなし。
begin;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles)
values ('root-mail-forwarding','','郵便の転送',array['super_admin']::text[]);

create function public.root_mail_forwarding_can_read() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from root_employees e
 left join system_view_permissions p on p.page_key='root-mail-forwarding' and p.tab_key=''
 where e.user_id=auth.uid() and e.is_active and e.deleted_at is null
 and (e.termination_date is null or e.termination_date>(now() at time zone 'Asia/Tokyo')::date)
 and (e.garden_role='super_admin' or e.garden_role=any(coalesce(p.roles,array['super_admin'])) or e.employee_id=any(p.employee_ids)))
$$;
revoke all on function public.root_mail_forwarding_can_read() from public,anon;
grant execute on function public.root_mail_forwarding_can_read() to authenticated;

create table public.root_mail_forwardings (
 id uuid primary key default gen_random_uuid(), holder text not null check(length(trim(holder))>0),
 from_address text not null check(length(trim(from_address))>0), to_address text not null check(length(trim(to_address))>0),
 notes text not null default '', stopped boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid not null default auth.uid(), updated_by uuid not null default auth.uid()
);
create table public.root_mail_forwarding_filings (
 id uuid primary key default gen_random_uuid(), forwarding_id uuid not null references public.root_mail_forwardings(id),
 filed_on date not null, method text not null default 'e転居' check(method in ('e転居','窓口')),
 receipt text not null default '', filed_by text not null default '', notes text not null default '',
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid()
);
create index on public.root_mail_forwarding_filings(forwarding_id,filed_on desc);
create table public.root_mail_forwarding_notices (
 forwarding_id uuid not null references public.root_mail_forwardings(id), filed_on date not null,
 stage text not null check(stage in ('60','30','14','7','expired')),
 sent_at timestamptz, lease_until timestamptz not null default now()+interval '10 minutes',
 primary key(forwarding_id,filed_on,stage)
);
alter table public.root_mail_forwardings enable row level security;
alter table public.root_mail_forwarding_filings enable row level security;
alter table public.root_mail_forwarding_notices enable row level security;
revoke all on public.root_mail_forwardings,public.root_mail_forwarding_filings,public.root_mail_forwarding_notices from anon,authenticated;
grant select,insert,update on public.root_mail_forwardings to authenticated;
grant select,insert on public.root_mail_forwarding_filings to authenticated;
grant select on public.root_mail_forwarding_notices to authenticated;
grant all on public.root_mail_forwardings,public.root_mail_forwarding_filings,public.root_mail_forwarding_notices to service_role;
create policy mail_read on public.root_mail_forwardings for select to authenticated using(public.root_mail_forwarding_can_read());
create policy mail_insert on public.root_mail_forwardings for insert to authenticated with check(public.root_is_super_admin());
create policy mail_update on public.root_mail_forwardings for update to authenticated using(public.root_is_super_admin()) with check(public.root_is_super_admin());
create policy filing_read on public.root_mail_forwarding_filings for select to authenticated using(public.root_mail_forwarding_can_read());
create policy filing_insert on public.root_mail_forwarding_filings for insert to authenticated with check(public.root_is_super_admin());
create policy notice_read on public.root_mail_forwarding_notices for select to authenticated using(public.root_is_super_admin());

create function public.root_mail_forwarding_stamp() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='INSERT' then new.created_at=now(); new.created_by=auth.uid();
 else new.created_at=old.created_at; new.created_by=old.created_by; end if;
 if TG_TABLE_NAME='root_mail_forwardings' then new.updated_at=now(); new.updated_by=auth.uid(); end if;
 return new;
end $$;
create trigger mail_stamp before insert or update on public.root_mail_forwardings for each row execute function public.root_mail_forwarding_stamp();
create trigger filing_stamp before insert on public.root_mail_forwarding_filings for each row execute function public.root_mail_forwarding_stamp();

-- 転送と最初の届出を同じトランザクションで保存する。呼出者の RLS を適用。
create function public.root_mail_forwarding_create(p_row jsonb,p_filing jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 insert into root_mail_forwardings(id,holder,from_address,to_address,notes)
 values((p_row->>'id')::uuid,p_row->>'holder',p_row->>'from_address',p_row->>'to_address',coalesce(p_row->>'notes','')) returning id into result;
 insert into root_mail_forwarding_filings(id,forwarding_id,filed_on,method,receipt,filed_by,notes)
 values((p_filing->>'id')::uuid,result,(p_filing->>'filed_on')::date,coalesce(p_filing->>'method','e転居'),coalesce(p_filing->>'receipt',''),coalesce(p_filing->>'filed_by',''),coalesce(p_filing->>'notes',''));
 return result;
end $$;
revoke all on function public.root_mail_forwarding_create(jsonb,jsonb) from public,anon;
grant execute on function public.root_mail_forwarding_create(jsonb,jsonb) to authenticated;

-- 同時実行で重複送信しないための予約。送信成功まで sent_at は空。
create function public.root_mail_forwarding_claim(p_id uuid,p_date date,p_stage text) returns boolean
language plpgsql security definer set search_path=public as $$
declare claimed integer;
begin
 insert into root_mail_forwarding_notices(forwarding_id,filed_on,stage) values(p_id,p_date,p_stage)
 on conflict(forwarding_id,filed_on,stage) do update set lease_until=now()+interval '10 minutes'
 where root_mail_forwarding_notices.sent_at is null and root_mail_forwarding_notices.lease_until<now();
 get diagnostics claimed=row_count;
 return claimed=1;
end $$;
revoke all on function public.root_mail_forwarding_claim(uuid,date,text) from public,anon,authenticated;
grant execute on function public.root_mail_forwarding_claim(uuid,date,text) to service_role;
commit;
