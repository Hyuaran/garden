create table public.soil_kanden_list (
  fm_rowid numeric primary key,
  kanri_no_raw text,
  kanri_no text,
  list_name text,
  customer_no text,
  customer_name text,
  customer_kana text,
  postal_code text,
  address1 text,
  address2 text,
  phone1 text,
  phone2 text,
  mobile text,
  billing_postal_code text,
  billing_address1 text,
  billing_address2 text,
  industry text,
  usage_code text,
  contract_type text,
  capacity text,
  power_contract text,
  power_capacity text,
  hapie text,
  annual_usage text,
  monthly_usage text,
  departure_provider text,
  departure_period text,
  demand text,
  monthly_power_usage text,
  current_charge text,
  new_charge text,
  savings text,
  electricity_offer text,
  electricity_charge text,
  electricity_savings text,
  gas_contract text,
  no_appointments text,
  no_electricity_appointments text,
  supply_point text,
  supply_started_on date,
  dm_sent_on date,
  usage_on date,
  fm_created_on date,
  fm_updated_on date,
  electricity_usage text[]
);

create index soil_kanden_list_kanri_no_idx
  on public.soil_kanden_list (kanri_no, fm_updated_on desc nulls last, fm_rowid desc);
create index soil_kanden_list_customer_no_idx on public.soil_kanden_list (customer_no);
create index soil_kanden_list_phone1_idx on public.soil_kanden_list (phone1);
create index soil_kanden_list_phone2_idx on public.soil_kanden_list (phone2);
create index soil_kanden_list_mobile_idx on public.soil_kanden_list (mobile);
create index soil_kanden_list_customer_kana_idx on public.soil_kanden_list (customer_kana);

create function public.soil_kanden_list_can_read() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.root_employees e
    join public.system_view_scopes s on s.tab_key = ''
      and s.page_key in ('system-forms-kanden', 'leaf-kanden-entry')
    left join public.system_view_permissions p on p.page_key = s.page_key and p.tab_key = s.tab_key
    where e.user_id = auth.uid() and e.is_active and e.deleted_at is null
      and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
      and (
        e.garden_role = 'super_admin'
        or ((s.page_key <> 'leaf-kanden-entry' or (now() at time zone 'Asia/Tokyo')::date >= date '2026-12-01')
          and (e.garden_role = any(coalesce(p.roles, s.default_roles)) or e.employee_id = any(p.employee_ids)))
      )
  );
$$;
revoke all on function public.soil_kanden_list_can_read() from public, anon;
grant execute on function public.soil_kanden_list_can_read() to authenticated;

alter table public.soil_kanden_list enable row level security;
revoke all on public.soil_kanden_list from public, anon, authenticated;
grant select on public.soil_kanden_list to authenticated;
grant select, insert, update on public.soil_kanden_list to service_role;
create policy soil_kanden_list_read on public.soil_kanden_list for select to authenticated
  using ((select public.soil_kanden_list_can_read()));

-- Compare the dates inside the upsert so overlapping imports cannot replace newer data.
create function public.soil_kanden_list_import(p_rows jsonb) returns integer
language plpgsql set search_path = '' as $$
declare
  affected integer;
begin
  insert into public.soil_kanden_list as stored
  select incoming.*
  from jsonb_populate_recordset(null::public.soil_kanden_list, p_rows) incoming
  order by incoming.fm_rowid
  on conflict (fm_rowid) do update set
    kanri_no_raw = excluded.kanri_no_raw,
    kanri_no = excluded.kanri_no,
    list_name = excluded.list_name,
    customer_no = excluded.customer_no,
    customer_name = excluded.customer_name,
    customer_kana = excluded.customer_kana,
    postal_code = excluded.postal_code,
    address1 = excluded.address1,
    address2 = excluded.address2,
    phone1 = excluded.phone1,
    phone2 = excluded.phone2,
    mobile = excluded.mobile,
    billing_postal_code = excluded.billing_postal_code,
    billing_address1 = excluded.billing_address1,
    billing_address2 = excluded.billing_address2,
    industry = excluded.industry,
    usage_code = excluded.usage_code,
    contract_type = excluded.contract_type,
    capacity = excluded.capacity,
    power_contract = excluded.power_contract,
    power_capacity = excluded.power_capacity,
    hapie = excluded.hapie,
    annual_usage = excluded.annual_usage,
    monthly_usage = excluded.monthly_usage,
    departure_provider = excluded.departure_provider,
    departure_period = excluded.departure_period,
    demand = excluded.demand,
    monthly_power_usage = excluded.monthly_power_usage,
    current_charge = excluded.current_charge,
    new_charge = excluded.new_charge,
    savings = excluded.savings,
    electricity_offer = excluded.electricity_offer,
    electricity_charge = excluded.electricity_charge,
    electricity_savings = excluded.electricity_savings,
    gas_contract = excluded.gas_contract,
    no_appointments = excluded.no_appointments,
    no_electricity_appointments = excluded.no_electricity_appointments,
    supply_point = excluded.supply_point,
    supply_started_on = excluded.supply_started_on,
    dm_sent_on = excluded.dm_sent_on,
    usage_on = excluded.usage_on,
    fm_created_on = excluded.fm_created_on,
    fm_updated_on = excluded.fm_updated_on,
    electricity_usage = excluded.electricity_usage
  where (stored.fm_updated_on is null or excluded.fm_updated_on >= stored.fm_updated_on)
    and stored is distinct from excluded;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.soil_kanden_list_import(jsonb) from public, anon, authenticated;
grant execute on function public.soil_kanden_list_import(jsonb) to service_role;

-- 2026-11-23 Claude：55 万件の個人情報をログイン中の人が直接まとめて読めないよう、読み取りはサーバー（service_role）だけにする
revoke select on public.soil_kanden_list from authenticated;
drop policy if exists soil_kanden_list_read on public.soil_kanden_list;
