-- 本番適用は Claude が行う。Codex は適用しない。
create table public.system_innovera_circuit_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30 and name = btrim(name) and name !~ '^\s|\s$'),
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.system_innovera_circuit_positions (
  circuit_id text primary key check (btrim(circuit_id) <> ''),
  circuit_name text,
  group_id uuid references public.system_innovera_circuit_groups(id) on delete set null,
  sort_order integer not null,
  updated_at timestamptz not null default now()
);
alter table public.system_innovera_circuit_groups enable row level security;
alter table public.system_innovera_circuit_positions enable row level security;
revoke all on public.system_innovera_circuit_groups, public.system_innovera_circuit_positions from public, anon, authenticated;
grant all on public.system_innovera_circuit_groups, public.system_innovera_circuit_positions to service_role;

create function public.system_innovera_save_circuit_order(p_groups jsonb, p_other jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  g jsonb; c jsonb; gid uuid; seen_ids uuid[] := '{}'; seen_names text[] := '{}';
  seen_circuits text[] := '{}'; n text; cid text; gi integer := 0; ci integer; old_groups jsonb;
begin
  -- Serialize whole-snapshot replacements, including concurrent administrators.
  perform pg_advisory_xact_lock(hashtextextended('system_innovera_circuit_order', 0));
  if jsonb_typeof(p_groups) is distinct from 'array' or jsonb_typeof(p_other) is distinct from 'array' then
    raise exception 'Invalid circuit order';
  end if;
  -- Remove positions first; any error rolls back the entire function call.
  delete from public.system_innovera_circuit_positions where true; -- Supabase の safeupdate は where なしの delete を止める
  -- Avoid transient unique-name conflicts when two existing headings exchange names.
  -- Rebuild groups with their original IDs and creation timestamps.
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into old_groups from public.system_innovera_circuit_groups t;
  delete from public.system_innovera_circuit_groups where true;
  for g in select value from jsonb_array_elements(p_groups) loop
    n := g->>'name';
    if jsonb_typeof(g->'name') is distinct from 'string' or n is null or char_length(n) not between 1 and 30
       or n <> btrim(n) or n ~ '^\s|\s$' or n = any(seen_names)
       or jsonb_typeof(g->'circuitIds') is distinct from 'array' then
      raise exception 'Invalid group name or circuits';
    end if;
    gid := coalesce((g->>'id')::uuid, gen_random_uuid());
    if gid = any(seen_ids) then raise exception 'Duplicate group ID'; end if;
    seen_ids := array_append(seen_ids, gid); seen_names := array_append(seen_names, n);
    insert into public.system_innovera_circuit_groups(id,name,sort_order,created_at,updated_at)
      values(gid,n,gi,coalesce((select (value->>'created_at')::timestamptz from jsonb_array_elements(old_groups) where value->>'id'=gid::text),now()),now());
    gi := gi + 1; ci := 0;
    for c in select value from jsonb_array_elements(g->'circuitIds') loop
      cid := c #>> '{}';
      if jsonb_typeof(c) <> 'string' or btrim(cid) = '' or cid = any(seen_circuits) then raise exception 'Invalid or duplicate circuit'; end if;
      seen_circuits := array_append(seen_circuits,cid);
      insert into public.system_innovera_circuit_positions(circuit_id,group_id,sort_order) values(cid,gid,ci);
      ci := ci + 1;
    end loop;
  end loop;
  ci := 0;
  for c in select value from jsonb_array_elements(p_other) loop
    cid := c #>> '{}';
    if jsonb_typeof(c) <> 'string' or btrim(cid) = '' or cid = any(seen_circuits) then raise exception 'Invalid or duplicate circuit'; end if;
    seen_circuits := array_append(seen_circuits,cid);
    insert into public.system_innovera_circuit_positions(circuit_id,group_id,sort_order) values(cid,null,ci);
    ci := ci + 1;
  end loop;
end;
$$;
revoke all on function public.system_innovera_save_circuit_order(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.system_innovera_save_circuit_order(jsonb,jsonb) to service_role;
