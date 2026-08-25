create table if not exists public.system_postal_datasets (
  id uuid primary key default gen_random_uuid(),
  source_date date not null,
  imported_at timestamptz not null default now(),
  row_count integer not null default 0 check (row_count >= 0),
  source_url text not null,
  active boolean not null default false
);

create unique index if not exists system_postal_datasets_one_active_idx
  on public.system_postal_datasets (active) where active;

create table if not exists public.system_postal_addresses (
  dataset_id uuid not null references public.system_postal_datasets(id) on delete cascade,
  postal_code text not null check (postal_code ~ '^[0-9]{7}$'),
  prefecture text not null,
  city text not null,
  town text not null,
  prefecture_kana text not null,
  city_kana text not null,
  town_kana text not null,
  is_special boolean not null default false
);

create index if not exists system_postal_addresses_lookup_idx
  on public.system_postal_addresses (dataset_id, postal_code);

alter table public.system_postal_datasets enable row level security;
alter table public.system_postal_addresses enable row level security;

create policy system_postal_datasets_authenticated_read on public.system_postal_datasets
  for select to authenticated using (active);

create or replace function public.activate_system_postal_dataset(p_dataset_id uuid, p_row_count integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from system_postal_datasets where id = p_dataset_id) then raise exception 'postal dataset not found'; end if;
  if (select count(*) from system_postal_addresses where dataset_id = p_dataset_id) <> p_row_count then raise exception 'postal row count mismatch'; end if;
  update system_postal_datasets set active = false where active;
  update system_postal_datasets set active = true, row_count = p_row_count, imported_at = now() where id = p_dataset_id;
  delete from system_postal_datasets where not active and id <> p_dataset_id and imported_at < now() - interval '35 days';
end;
$$;

revoke all on function public.activate_system_postal_dataset(uuid, integer) from public, anon, authenticated;
grant execute on function public.activate_system_postal_dataset(uuid, integer) to service_role;

comment on table public.system_postal_datasets is 'Versioned Japan Post postal datasets; exactly one completed dataset is active.';
comment on table public.system_postal_addresses is 'Japan Post UTF-8 KEN_ALL address candidates, including duplicate postal codes.';
