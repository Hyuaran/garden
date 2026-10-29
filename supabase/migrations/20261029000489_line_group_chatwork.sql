alter table public.system_line_target
  alter column line_target_id drop not null,
  add column account text not null default 'dev' check (account in ('dev','official')),
  add column chatwork_room_id text check (chatwork_room_id ~ '^[0-9]+$'),
  add column notify_enabled boolean not null default false,
  add column link_code text unique,
  add column link_code_expires_at timestamptz,
  add column linked_at timestamptz;

-- Consume a code and release the unique destination in one transaction.
create function public.link_line_group(p_code text, p_target text, p_type text)
returns text language plpgsql security definer set search_path = public as $$
declare pending public.system_line_target%rowtype; existing public.system_line_target%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext(p_target));
  select * into pending from public.system_line_target
    where link_code = p_code and account = 'dev' and active
      and link_code_expires_at > now() for update;
  if not found then return null; end if;
  -- 同じグループの記録が既にある（NHK 集計の合言葉など）ときは、そちらに名前と知らせ先を書き足して残す
  select * into existing from public.system_line_target
    where line_target_id = p_target and id <> pending.id order by active desc, joined_at desc limit 1 for update;
  if found then
    update public.system_line_target set label = coalesce(pending.label, existing.label),
      chatwork_room_id = pending.chatwork_room_id, notify_enabled = pending.notify_enabled,
      linked_at = now(), active = true, left_at = null, account = pending.account
      where id = existing.id;
    delete from public.system_line_target where id = pending.id;
    return coalesce(pending.label, existing.label, '（名前なし）');
  end if;
  update public.system_line_target set line_target_id = p_target,
    target_type = p_type, linked_at = now(), link_code = null,
    link_code_expires_at = null, active = true, left_at = null
    where id = pending.id;
  return coalesce(pending.label, '（名前なし）');
end;
$$;
revoke all on function public.link_line_group(text,text,text) from public, anon, authenticated;
grant execute on function public.link_line_group(text,text,text) to service_role;
