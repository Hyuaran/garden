begin;

insert into public.system_view_scopes (page_key, tab_key, label, default_roles)
values ('leaf-kanden-entry', '', '関電 事務入力', array['manager', 'admin', 'super_admin']::text[])
on conflict (page_key, tab_key) do update
set label = excluded.label, default_roles = excluded.default_roles;

alter table public.leaf_kanden_orders
  add column if not exists source text not null default 'filemaker' check (source in ('filemaker', 'garden')),
  add column if not exists status text check (status in ('受注', '諸元待ち', 'エントリー待ち', '送付待ち', '請求待ち', '入金待ち', '支払待ち', '完了', '保留', '差し戻し', 'キャンセル')),
  add column if not exists urgent_sw boolean,
  add column if not exists sw_month integer check (sw_month between 1 and 12),
  add column if not exists has_denki boolean,
  add column if not exists has_douryoku boolean,
  add column if not exists has_gas boolean,
  add column if not exists payment_received_on date,
  add column if not exists payment_sent_on date,
  add column if not exists completed_on date,
  add column if not exists submission_id uuid references public.leaf_kanden_submissions(id),
  add column if not exists garden_updated_at timestamptz,
  add column if not exists garden_updated_by text,
  add column if not exists hold_reason text,
  add column if not exists return_reason text,
  add column if not exists is_direct boolean,
  alter column fm_pk drop not null,
  drop constraint if exists leaf_kanden_orders_fm_pk_key;

create unique index if not exists leaf_kanden_orders_fm_pk_idx on public.leaf_kanden_orders (fm_pk) where fm_pk is not null;
create unique index if not exists leaf_kanden_orders_submission_idx on public.leaf_kanden_orders (submission_id) where submission_id is not null;
create unique index if not exists leaf_kanden_orders_garden_kanri_idx on public.leaf_kanden_orders (kanri_no) where source = 'garden' and kanri_no is not null;
create index if not exists leaf_kanden_specs_kanri_idx on public.leaf_kanden_photos (kanri_no) where category = '諸元';
create index if not exists leaf_kanden_specs_set_idx on public.leaf_kanden_photos (set_id) where category = '諸元';

create table if not exists public.leaf_kanden_order_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.leaf_kanden_orders(id),
  changed_at timestamptz not null,
  changed_by text not null,
  field text not null,
  old_value jsonb,
  new_value jsonb
);
create index if not exists leaf_kanden_order_history_order_idx on public.leaf_kanden_order_history (order_id, changed_at);
alter table public.leaf_kanden_order_history enable row level security;
revoke all on public.leaf_kanden_order_history from anon, authenticated;
grant select, insert on public.leaf_kanden_order_history to service_role;

-- The original list has its own FileMaker status. Keep that contract after adding orders.status.
create or replace function public.leaf_kanden_case_list(p_year integer, p_tab text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with yearly as materialized (
    select o.*,
      case
        when o.cancelled_on is not null or o.progress like '%キャンセル%' then 'cancelled'
        when o.progress = 'エントリー完了' then 'completed'
        else 'active'
      end as legacy_status
    from public.leaf_kanden_orders o
    where o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ),
  selected as materialized (select * from yearly where legacy_status = p_tab),
  photo_counts as (
    select p.kanri_no, count(*) as photo_count
    from (select distinct kanri_no from selected where kanri_no is not null) s
    join public.leaf_kanden_photos p using (kanri_no)
    where p.image_path !~* '\.pdf$'
    group by p.kanri_no
  )
  select jsonb_build_object(
    'hasOrders', exists (select 1 from public.leaf_kanden_orders),
    'updatedAt', (select max(finished_at) from public.leaf_kanden_import_runs where source = 'filemaker'),
    'years', coalesce((
      select jsonb_agg(year order by year desc)
      from (select distinct extract(year from ordered_on - interval '3 months')::int as year
            from public.leaf_kanden_orders where ordered_on is not null) years
    ), '[]'::jsonb),
    'counts', (select jsonb_build_object(
      'active', count(*) filter (where legacy_status = 'active'),
      'completed', count(*) filter (where legacy_status = 'completed'),
      'cancelled', count(*) filter (where legacy_status = 'cancelled')
    ) from yearly),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'kanri_no', s.kanri_no, 'kanri_no_raw', s.kanri_no_raw,
        'ordered_on', s.ordered_on, 'customer_name', s.customer_name, 'customer_kana', s.customer_kana,
        'address', s.address, 'acquisition', s.acquisition, 'contract_type', s.contract_type,
        'progress', s.progress, 'entered_on', s.entered_on, 'app_sent_on', s.app_sent_on,
        'invoice_sent_on', s.invoice_sent_on, 'sales_name', s.sales_name, 'clerk_name', s.clerk_name,
        'photo_count', coalesce(p.photo_count, 0)
      ) order by s.ordered_on desc, s.fm_pk desc)
      from selected s left join photo_counts p using (kanri_no)
    ), '[]'::jsonb)
  );
$$;

-- A partial unique index must be named by its predicate in the FileMaker upsert.
create function public.leaf_kanden_import_orders(p_rows jsonb)
returns void language sql set search_path = '' as $$
  insert into public.leaf_kanden_orders as existing (fm_pk, kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, app_sent_on, invoice_sent_on, cancelled_on, payment_confirmed, fc_result, progress, acquisition, acquisition_method, order_method, sales_name, clerk_name, list_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, billing_amount, fm_created_at, fm_updated_at, imported_at)
  select fm_pk, kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, app_sent_on, invoice_sent_on, cancelled_on, payment_confirmed, fc_result, progress, acquisition, acquisition_method, order_method, sales_name, clerk_name, list_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, billing_amount, fm_created_at, fm_updated_at, now()
  from jsonb_populate_recordset(null::public.leaf_kanden_orders, p_rows)
  on conflict (fm_pk) where fm_pk is not null do update
    set kanri_no = excluded.kanri_no,
        kanri_no_raw = excluded.kanri_no_raw,
        ordered_on = excluded.ordered_on,
        entered_on = excluded.entered_on,
        specs_on = excluded.specs_on,
        app_sent_on = excluded.app_sent_on,
        invoice_sent_on = excluded.invoice_sent_on,
        cancelled_on = excluded.cancelled_on,
        payment_confirmed = excluded.payment_confirmed,
        fc_result = excluded.fc_result,
        progress = excluded.progress,
        acquisition = excluded.acquisition,
        acquisition_method = excluded.acquisition_method,
        order_method = excluded.order_method,
        sales_name = excluded.sales_name,
        clerk_name = excluded.clerk_name,
        list_name = excluded.list_name,
        contract_type = excluded.contract_type,
        power_apply = excluded.power_apply,
        plan = excluded.plan,
        phone = excluded.phone,
        denki_customer_no = excluded.denki_customer_no,
        denki_supply_point = excluded.denki_supply_point,
        douryoku_customer_no = excluded.douryoku_customer_no,
        douryoku_supply_point = excluded.douryoku_supply_point,
        gas_customer_no = excluded.gas_customer_no,
        gas_supply_point = excluded.gas_supply_point,
        note = excluded.note,
        customer_name = excluded.customer_name,
        customer_kana = excluded.customer_kana,
        postal_code = excluded.postal_code,
        address = excluded.address,
        billing_amount = excluded.billing_amount,
        fm_created_at = excluded.fm_created_at,
        fm_updated_at = excluded.fm_updated_at,
        imported_at = excluded.imported_at
    where existing.garden_updated_at is null;
$$;

-- Read-time status also reflects documents added to the intake after the clerk last saved.
create function public.leaf_kanden_entry_list()
returns jsonb language sql stable set search_path = '' as $$
  with orders as (
    select o.id, o.kanri_no, o.customer_name, o.ordered_on,
      case
        when o.cancelled_on is not null then 'キャンセル'
        when o.status in ('保留', '差し戻し') then o.status
        when o.completed_on is not null or o.payment_sent_on is not null
          or (o.is_direct and o.payment_received_on is not null) then '完了'
        when o.payment_received_on is not null then '支払待ち'
        when o.invoice_sent_on is not null then '入金待ち'
        when o.app_sent_on is not null then '請求待ち'
        when o.entered_on is not null then '送付待ち'
        when o.specs_on is not null
          or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
            and p.image_path !~* '\.pdf$' and p.kanri_no = o.kanri_no)
          or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
            and p.image_path !~* '\.pdf$' and p.set_id = s.set_id) then 'エントリー待ち'
        when o.ordered_on is not null then '諸元待ち'
        else '受注'
      end as effective_status,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on) as search,
      array[o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point] as supply,
      greatest(o.garden_updated_at, o.imported_at, s.updated_at) as updated_at
    from public.leaf_kanden_orders o
    left join public.leaf_kanden_submissions s on s.id = o.submission_id
    union all
    select s.id, s.kanri_no, s.customer_name, null::date, '受付待ち',
      concat_ws(' ', s.kanri_no, s.kanri_no_raw, s.customer_name, s.employee_name),
      null::text[], s.updated_at
    from public.leaf_kanden_submissions s
    where not exists (select 1 from public.leaf_kanden_orders o where o.submission_id = s.id)
      and not exists (select 1 from public.leaf_kanden_orders o where o.kanri_no = s.kanri_no)
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_array(id, kanri_no, customer_name, ordered_on, effective_status, search, supply)
      order by ordered_on desc nulls last, updated_at desc, id), '[]'::jsonb),
    'updatedAt', max(updated_at),
    'options', (select jsonb_build_object(
      'contract_type', array_agg(distinct contract_type order by contract_type) filter (where nullif(contract_type, '') is not null),
      'plan', array_agg(distinct plan order by plan) filter (where nullif(plan, '') is not null),
      'power_apply', array_agg(distinct power_apply order by power_apply) filter (where nullif(power_apply, '') is not null),
      'acquisition_method', array_agg(distinct acquisition_method order by acquisition_method) filter (where nullif(acquisition_method, '') is not null)
    ) from public.leaf_kanden_orders)
  ) from orders;
$$;

create function public.leaf_kanden_save_entry(
  p_order uuid, p_submission uuid, p_version timestamptz, p_actor text, p_patch jsonb
) returns uuid language plpgsql set search_path = '' as $$
declare
  before_row public.leaf_kanden_orders;
  after_row public.leaf_kanden_orders;
  intake public.leaf_kanden_submissions;
  saved_at timestamptz;
begin
  if p_order is null then
    select * into strict intake from public.leaf_kanden_submissions where id = p_submission for update;
    if intake.updated_at is distinct from p_version
      or exists (select 1 from public.leaf_kanden_orders o where o.submission_id = intake.id or o.kanri_no = intake.kanri_no) then
      raise sqlstate '40001';
    end if;
    before_row.id := gen_random_uuid();
    before_row.submission_id := intake.id;
    before_row.source := 'garden';
    before_row.imported_at := now();
  else
    select * into strict before_row from public.leaf_kanden_orders where id = p_order for update;
    if coalesce(before_row.garden_updated_at, before_row.imported_at) is distinct from p_version then
      raise sqlstate '40001';
    end if;
  end if;

  after_row := jsonb_populate_record(before_row, p_patch);
  saved_at := clock_timestamp();
  if after_row.source = 'garden' and after_row.kanri_no is not null
    and exists (select 1 from public.leaf_kanden_orders o where o.kanri_no = after_row.kanri_no and o.id <> after_row.id) then
    raise sqlstate '23505';
  end if;

  if p_order is null then
    insert into public.leaf_kanden_orders (id, source, submission_id, garden_updated_at, garden_updated_by,
      kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, app_sent_on, invoice_sent_on, cancelled_on, acquisition, acquisition_method, sales_name, clerk_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, status, urgent_sw, sw_month, has_denki, has_douryoku, has_gas, payment_received_on, payment_sent_on, completed_on, hold_reason, return_reason, is_direct)
    values (after_row.id, 'garden', intake.id, saved_at, p_actor,
      after_row.kanri_no, after_row.kanri_no_raw, after_row.ordered_on, after_row.entered_on, after_row.specs_on, after_row.app_sent_on, after_row.invoice_sent_on, after_row.cancelled_on, after_row.acquisition, after_row.acquisition_method, after_row.sales_name, after_row.clerk_name, after_row.contract_type, after_row.power_apply, after_row.plan, after_row.phone, after_row.denki_customer_no, after_row.denki_supply_point, after_row.douryoku_customer_no, after_row.douryoku_supply_point, after_row.gas_customer_no, after_row.gas_supply_point, after_row.note, after_row.customer_name, after_row.customer_kana, after_row.postal_code, after_row.address, after_row.status, after_row.urgent_sw, after_row.sw_month, after_row.has_denki, after_row.has_douryoku, after_row.has_gas, after_row.payment_received_on, after_row.payment_sent_on, after_row.completed_on, after_row.hold_reason, after_row.return_reason, after_row.is_direct);
  else
    update public.leaf_kanden_orders set
      kanri_no = after_row.kanri_no,
      kanri_no_raw = after_row.kanri_no_raw,
      ordered_on = after_row.ordered_on,
      entered_on = after_row.entered_on,
      specs_on = after_row.specs_on,
      app_sent_on = after_row.app_sent_on,
      invoice_sent_on = after_row.invoice_sent_on,
      cancelled_on = after_row.cancelled_on,
      acquisition = after_row.acquisition,
      acquisition_method = after_row.acquisition_method,
      sales_name = after_row.sales_name,
      clerk_name = after_row.clerk_name,
      contract_type = after_row.contract_type,
      power_apply = after_row.power_apply,
      plan = after_row.plan,
      phone = after_row.phone,
      denki_customer_no = after_row.denki_customer_no,
      denki_supply_point = after_row.denki_supply_point,
      douryoku_customer_no = after_row.douryoku_customer_no,
      douryoku_supply_point = after_row.douryoku_supply_point,
      gas_customer_no = after_row.gas_customer_no,
      gas_supply_point = after_row.gas_supply_point,
      note = after_row.note,
      customer_name = after_row.customer_name,
      customer_kana = after_row.customer_kana,
      postal_code = after_row.postal_code,
      address = after_row.address,
      status = after_row.status,
      urgent_sw = after_row.urgent_sw,
      sw_month = after_row.sw_month,
      has_denki = after_row.has_denki,
      has_douryoku = after_row.has_douryoku,
      has_gas = after_row.has_gas,
      payment_received_on = after_row.payment_received_on,
      payment_sent_on = after_row.payment_sent_on,
      completed_on = after_row.completed_on,
      hold_reason = after_row.hold_reason,
      return_reason = after_row.return_reason,
      is_direct = after_row.is_direct,
      garden_updated_at = saved_at, garden_updated_by = p_actor
    where id = p_order;
  end if;

  insert into public.leaf_kanden_order_history (order_id, changed_at, changed_by, field, old_value, new_value)
    select after_row.id, saved_at, p_actor, field.key, to_jsonb(before_row) -> field.key, field.value
    from jsonb_each(p_patch) as field
    where (to_jsonb(before_row) -> field.key) is distinct from field.value;

  return after_row.id;
end;
$$;

revoke execute on function public.leaf_kanden_import_orders(jsonb), public.leaf_kanden_entry_list(),
  public.leaf_kanden_save_entry(uuid,uuid,timestamptz,text,jsonb) from public, anon, authenticated;
grant execute on function public.leaf_kanden_import_orders(jsonb), public.leaf_kanden_entry_list(),
  public.leaf_kanden_save_entry(uuid,uuid,timestamptz,text,jsonb) to service_role;

commit;
