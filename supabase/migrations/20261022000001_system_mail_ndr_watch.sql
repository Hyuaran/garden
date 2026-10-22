-- 初回開始日時は最初の通常実行で確定する。migration 適用日時は使わない。
create table public.system_mail_ndr_watch_state (
  id integer primary key default 1 check (id = 1),
  started_at timestamptz,
  last_run_at timestamptz,
  outage boolean not null default false,
  outage_notified boolean not null default false,
  lock_owner uuid,
  locked_until timestamptz
);
insert into public.system_mail_ndr_watch_state (id) values (1);
create table public.system_mail_ndr_alerts (
  message_id text primary key,
  mailbox text not null,
  kind text not null,
  original_subject text not null,
  recipients text not null,
  original_sent_at timestamptz,
  received_at timestamptz not null,
  notified_at timestamptz not null
);
alter table public.system_mail_ndr_watch_state enable row level security;
alter table public.system_mail_ndr_alerts enable row level security;
revoke all on public.system_mail_ndr_watch_state, public.system_mail_ndr_alerts from public, anon, authenticated;
grant all on public.system_mail_ndr_watch_state, public.system_mail_ndr_alerts to service_role;
-- Vercel の最大実行時間より長いリースで同時起動の二重配信を防ぐ。
create function public.system_mail_ndr_watch_lock(p_owner uuid) returns boolean
language plpgsql security invoker set search_path = public as $$
begin
  update public.system_mail_ndr_watch_state
  set lock_owner = p_owner, locked_until = now() + interval '10 minutes'
  where id = 1 and (locked_until is null or locked_until < now());
  return found;
end;
$$;
create function public.system_mail_ndr_watch_unlock(p_owner uuid) returns void
language sql security invoker set search_path = public as $$
  update public.system_mail_ndr_watch_state set lock_owner = null, locked_until = null
  where id = 1 and lock_owner = p_owner;
$$;
revoke all on function public.system_mail_ndr_watch_lock(uuid), public.system_mail_ndr_watch_unlock(uuid) from public, anon, authenticated;
grant execute on function public.system_mail_ndr_watch_lock(uuid), public.system_mail_ndr_watch_unlock(uuid) to service_role;
