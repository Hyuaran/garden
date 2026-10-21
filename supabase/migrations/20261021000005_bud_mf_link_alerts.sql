alter table public.bud_mf_accounts add column mail_alias text;
create table public.bud_mf_link_alert_messages (
 message_id text primary key, received_at timestamptz not null
);
create table public.bud_mf_link_alerts (
 id uuid primary key default gen_random_uuid(),
 message_id text not null references public.bud_mf_link_alert_messages(message_id),
 received_at timestamptz not null, mail_account_name text not null,
 last_success_date date not null, reason text not null, reason_text text not null default '',
 mf_account_id text references public.bud_mf_accounts(mf_account_id),
 dismissed_at timestamptz, dismissed_by text references public.root_employees(employee_id),
 active boolean not null default false, unique(message_id,mail_account_name)
);
create index on public.bud_mf_link_alerts(mail_account_name,received_at desc);
alter table public.bud_mf_link_alert_messages enable row level security;
alter table public.bud_mf_link_alerts enable row level security;
create policy mf_link_alerts_read on public.bud_mf_link_alerts for select to authenticated using (
 public.bud_has_access() and (public.bud_is_super_admin() or exists (
 select 1 from public.bud_mf_accounts a where a.mf_account_id = bud_mf_link_alerts.mf_account_id))
);
revoke all on public.bud_mf_link_alert_messages, public.bud_mf_link_alerts from anon, authenticated;
grant select on public.bud_mf_link_alerts to authenticated;
grant all on public.bud_mf_link_alert_messages, public.bud_mf_link_alerts to service_role;

-- Keep empty messages too, so a newer empty list clears the previous warning.
create function public.bud_mf_apply_link_alerts(p_messages jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb; latest_id text;
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_link_alerts'));
 for m in select value from jsonb_array_elements(p_messages) loop
  insert into bud_mf_link_alert_messages(message_id,received_at)
  values(m->>'message_id',(m->>'received_at')::timestamptz) on conflict do nothing;
  insert into bud_mf_link_alerts(message_id,received_at,mail_account_name,last_success_date,reason,reason_text,mf_account_id)
  select m->>'message_id',(m->>'received_at')::timestamptz,x.mail_account_name,x.last_success_date,x.reason,x.reason_text,x.mf_account_id
  from jsonb_to_recordset(m->'alerts') as x(mail_account_name text,last_success_date date,reason text,reason_text text,mf_account_id text)
  on conflict(message_id,mail_account_name) do update set mf_account_id=excluded.mf_account_id;
 end loop;
 select message_id into latest_id from bud_mf_link_alert_messages order by received_at desc,message_id desc limit 1;
 update bud_mf_link_alerts a set active = (a.message_id=latest_id and not exists (
  select 1 from bud_mf_link_alerts d where d.mail_account_name=a.mail_account_name and d.dismissed_at >= a.received_at
 )) where true; -- Supabase は WHERE の無い UPDATE を断る
end $$;
revoke all on function public.bud_mf_apply_link_alerts(jsonb) from public,anon,authenticated;
grant execute on function public.bud_mf_apply_link_alerts(jsonb) to service_role;

create function public.bud_mf_dismiss_link_alert(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare target public.bud_mf_link_alerts; employee text;
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_link_alerts'));
 if not public.bud_has_access() then raise exception 'forbidden'; end if;
 select * into target from bud_mf_link_alerts where id=p_id for update;
 if not found then raise exception 'missing'; end if;
 select employee_id into employee from root_employees where user_id=auth.uid() and deleted_at is null;
 if employee is null or (not public.bud_is_super_admin() and not exists (
  select 1 from bud_mf_accounts a where a.mf_account_id=target.mf_account_id and not a.hidden and employee=any(a.visible_employee_ids)
 )) then raise exception 'forbidden'; end if;
 -- Preserve the original audit on retries.
 update bud_mf_link_alerts set dismissed_at=coalesce(dismissed_at,now()),dismissed_by=coalesce(dismissed_by,employee),active=false where id=p_id;
 update bud_mf_link_alerts set active=false where mail_account_name=target.mail_account_name and received_at <= now();
end $$;
revoke all on function public.bud_mf_dismiss_link_alert(uuid) from public,anon,authenticated;
grant execute on function public.bud_mf_dismiss_link_alert(uuid) to authenticated;

-- Extend settings atomically while preserving existing callers.
alter function public.bud_mf_save_settings(text,text[],boolean,text,text,text,bigint,date,timestamptz) rename to bud_mf_save_settings_before_mail;
revoke all on function public.bud_mf_save_settings_before_mail(text,text[],boolean,text,text,text,bigint,date,timestamptz) from public,anon,authenticated;
create function public.bud_mf_save_settings(p_id text,p_viewers text[],p_hidden boolean,p_book text,p_mode text,p_note text,p_anchor_balance bigint default null,p_anchor_date date default null,p_anchor_at timestamptz default null,p_mail_alias text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 if length(p_mail_alias)>500 then raise exception 'invalid alias'; end if;
 perform public.bud_mf_save_settings_before_mail(p_id,p_viewers,p_hidden,p_book,p_mode,p_note,p_anchor_balance,p_anchor_date,p_anchor_at);
 update bud_mf_accounts set mail_alias=nullif(trim(p_mail_alias),'') where mf_account_id=p_id;
end $$;
revoke all on function public.bud_mf_save_settings(text,text[],boolean,text,text,text,bigint,date,timestamptz,text) from public,anon,authenticated;
grant execute on function public.bud_mf_save_settings(text,text[],boolean,text,text,text,bigint,date,timestamptz,text) to authenticated;
