-- Provision the secret hash separately; never store plaintext secrets here.
create table public.system_call_sync_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error text
);
-- Prevent concurrent POSTs from creating duplicate active requests.
create unique index system_call_sync_requests_active on public.system_call_sync_requests ((true)) where status in ('queued','running');
alter table public.system_call_sync_requests enable row level security;
revoke all on public.system_call_sync_requests from public, anon, authenticated;
grant all on public.system_call_sync_requests to service_role;
create table public.system_callcenter_agent_auth (
  id text primary key check (id = 'host-pc'),
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  last_seen_at timestamptz,
  agent_version text
);
alter table public.system_callcenter_agent_auth enable row level security;
revoke all on public.system_callcenter_agent_auth from public, anon, authenticated;
grant all on public.system_callcenter_agent_auth to service_role;

create function public.system_callcenter_agent_take_request(p_secret text, p_agent_version text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare stored_hash text; job_id uuid;
begin
  select secret_hash into stored_hash from public.system_callcenter_agent_auth where id = 'host-pc' for update;
  if nullif(stored_hash, '') is null or nullif(p_secret, '') is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from stored_hash then
    raise exception 'unauthorized';
  end if;
  update public.system_callcenter_agent_auth set last_seen_at = now(), agent_version = p_agent_version where id = 'host-pc';
  update public.system_call_sync_requests set status = 'failed', finished_at = now(), error = 'stale'
    where status = 'running' and started_at <= now() - interval '10 minutes';
  select id into job_id from public.system_call_sync_requests where status = 'queued' order by requested_at, id limit 1 for update skip locked;
  if job_id is null then return null; end if;
  update public.system_call_sync_requests set status = 'running', started_at = now() where id = job_id;
  return jsonb_build_object('id', job_id);
end;
$$;
create function public.system_callcenter_agent_finish_request(p_secret text, p_id uuid, p_ok boolean, p_error text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare stored_hash text;
begin
  select secret_hash into stored_hash from public.system_callcenter_agent_auth where id = 'host-pc';
  if nullif(stored_hash, '') is null or nullif(p_secret, '') is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from stored_hash then
    raise exception 'unauthorized';
  end if;
  update public.system_call_sync_requests set status = case when p_ok then 'done' else 'failed' end,
    finished_at = now(), error = case when p_ok then null else left(p_error, 1000) end
    where id = p_id and status = 'running';
  return found;
end;
$$;
revoke all on function public.system_callcenter_agent_take_request(text, text) from public;
revoke all on function public.system_callcenter_agent_finish_request(text, uuid, boolean, text) from public;
grant execute on function public.system_callcenter_agent_take_request(text, text) to anon;
grant execute on function public.system_callcenter_agent_finish_request(text, uuid, boolean, text) to anon;
