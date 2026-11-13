-- Provision the secret hash separately; never store plaintext secrets here.
create table public.system_zenkaku_agent_auth (
  id text primary key check (id = 'host-pc'),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  last_seen_at timestamptz,
  agent_version text
);
alter table public.system_zenkaku_agent_auth enable row level security;
revoke all on table public.system_zenkaku_agent_auth from public, anon, authenticated;
create or replace function public.system_zenkaku_agent_next(p_secret text, p_agent_version text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare stored_hash text; job record;
begin
  select secret_hash into stored_hash from public.system_zenkaku_agent_auth where id = 'host-pc';
  if nullif(stored_hash, '') is null or nullif(p_secret, '') is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from stored_hash then
    raise exception 'unauthorized';
  end if;
  update public.system_zenkaku_agent_auth set last_seen_at = now(), agent_version = p_agent_version where id = 'host-pc';
  select * into job from public.system_zenkaku_submit_claim_next();
  if found then return jsonb_build_object('id', job.id, 'salesId', job.sales_id, 'operation', 'submit'); end if;
  select * into job from public.system_zenkaku_claim_next();
  if found then return jsonb_build_object('id', job.id, 'salesId', job.sales_id, 'operation', 'check'); end if;
  return null;
end;
$$;
revoke all on function public.system_zenkaku_agent_next(text, text) from public;
grant execute on function public.system_zenkaku_agent_next(text, text) to anon;
