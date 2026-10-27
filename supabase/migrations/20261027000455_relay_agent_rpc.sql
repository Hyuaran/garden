alter table public.system_relay_heartbeat add column if not exists agent_secret_hash text;

create or replace function public.system_relay_agent_pull(p_secret text, p_agent_version text)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  secret_hash text;
  job public.system_relay_jobs%rowtype;
begin
  select agent_secret_hash into secret_hash from public.system_relay_heartbeat where id = 'host-pc';
  if nullif(secret_hash, '') is null or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from secret_hash then
    raise exception 'unauthorized';
  end if;

  update public.system_relay_heartbeat
    set last_seen_at = now(), agent_version = p_agent_version, updated_at = now()
    where id = 'host-pc';
  update public.system_relay_jobs
    set status = 'expired', finished_at = now(), error = 'relay_timeout'
    where status = 'queued' and expires_at <= now();

  select * into job from public.system_relay_jobs
    where status = 'queued' and expires_at > now()
    order by created_at asc limit 1 for update skip locked;
  if not found then return null; end if;
  update public.system_relay_jobs set status = 'running', started_at = now() where id = job.id;
  return jsonb_build_object('id', job.id, 'kind', job.kind, 'request', job.request);
end;
$$;

create or replace function public.system_relay_agent_result(
  p_secret text, p_id uuid, p_ok boolean, p_result jsonb, p_error text
)
returns boolean
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  secret_hash text;
begin
  select agent_secret_hash into secret_hash from public.system_relay_heartbeat where id = 'host-pc';
  if nullif(secret_hash, '') is null or p_secret is null
     or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from secret_hash then
    raise exception 'unauthorized';
  end if;
  update public.system_relay_jobs
    set status = case when p_ok then 'done' else 'failed' end,
        result = p_result,
        error = case when p_ok then null else coalesce(nullif(p_error, ''), 'relay_failed') end,
        finished_at = now()
    where id = p_id;
  return found;
end;
$$;

revoke all on function public.system_relay_agent_pull(text, text) from public;
revoke all on function public.system_relay_agent_result(text, uuid, boolean, jsonb, text) from public;
grant execute on function public.system_relay_agent_pull(text, text) to anon;
grant execute on function public.system_relay_agent_result(text, uuid, boolean, jsonb, text) to anon;
