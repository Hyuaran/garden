begin;

alter table public.leaf_kanden_orders
  add column jisseki_month text check (jisseki_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  add column application_received_on date,
  add column mailed_on date,
  add column paid_on date,
  add column refunded_on date,
  add column timetree_label text,
  add column cancel_reason text,
  add column flow_updated_at timestamptz,
  drop constraint leaf_kanden_orders_status_check;

update public.leaf_kanden_orders set status = null
where status not in ('保留', '差し戻し');

update public.leaf_kanden_orders set cancel_reason = '取消日あり'
where cancelled_on is not null;

alter table public.leaf_kanden_orders add constraint leaf_kanden_orders_status_check
  check (status in ('諸元待ち', 'エントリー待ち', '申込書待ち', '郵送待ち', '入金待ち', '完了', 'キャンセル', '保留', '差し戻し'));

create table public.leaf_kanden_payments (
  id uuid primary key default gen_random_uuid(),
  pd_row_no text not null unique,
  statement_month text not null check (statement_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  sales_name text,
  sales_method text,
  customer_name text,
  customer_kana text,
  list_flag text,
  acquisition text,
  item text,
  note text,
  sent_on date,
  customer_no text,
  kanri_no text,
  kanri_no_raw text,
  amount integer,
  order_id uuid references public.leaf_kanden_orders(id),
  match_note text,
  source_file text,
  imported_at timestamptz not null default now()
);

create index leaf_kanden_payments_order_idx on public.leaf_kanden_payments (order_id, statement_month, pd_row_no);
create index leaf_kanden_payments_month_idx on public.leaf_kanden_payments (statement_month desc);
alter table public.leaf_kanden_payments enable row level security;
revoke all on public.leaf_kanden_payments from anon, authenticated;
grant select, insert, update on public.leaf_kanden_payments to service_role;

create function public.leaf_kanden_order_status(o public.leaf_kanden_orders)
returns text language sql stable set search_path = '' as $$
  select case
    when o.status in ('保留', '差し戻し') then o.status
    when o.cancelled_on is not null or o.refunded_on is not null
      or (o.cancel_reason = '郵送前キャンセル（入金なし）' and o.paid_on is null) then 'キャンセル'
    when o.paid_on is not null then '完了'
    when o.mailed_on is not null then '入金待ち'
    when o.application_received_on is not null then '郵送待ち'
    when o.entered_on is not null then '申込書待ち'
    when o.specs_on is not null
      or btrim(o.timetree_label, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') not in ('', '諸元待ち')
      or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
        and p.image_path !~* '\.pdf$' and p.kanri_no = o.kanri_no)
      or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
        and p.image_path !~* '\.pdf$' and p.set_id = (
          select s.set_id from public.leaf_kanden_submissions s
          where s.id = o.submission_id or (o.submission_id is null and s.kanri_no = o.kanri_no)
          order by s.submitted_at desc, s.id limit 1
        )) then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

create or replace function public.leaf_kanden_case_list(p_year integer, p_tab text)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with yearly as materialized (
    select o.*,
      public.leaf_kanden_order_status(o) as effective_status
    from public.leaf_kanden_orders o
    where o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ),
  selected as materialized (select * from yearly where case effective_status when '完了' then 'completed'
    when 'キャンセル' then 'cancelled' else 'active' end = p_tab),
  photo_counts as (
    select p.kanri_no, count(*) as photo_count
    from (select distinct kanri_no from selected where kanri_no is not null) s
    join public.leaf_kanden_photos p using (kanri_no)
    where p.image_path !~* '\.pdf$'
    group by p.kanri_no
  )
  select jsonb_build_object(
    'hasOrders', exists (select 1 from public.leaf_kanden_orders),
    'updatedAt', greatest((select max(finished_at) from public.leaf_kanden_import_runs where source = 'filemaker'),
      (select max(flow_updated_at) from public.leaf_kanden_orders),
      (select max(garden_updated_at) from public.leaf_kanden_orders)),
    'years', coalesce((
      select jsonb_agg(year order by year desc)
      from (select distinct extract(year from ordered_on - interval '3 months')::int as year
            from public.leaf_kanden_orders where ordered_on is not null) years
    ), '[]'::jsonb),
    'counts', (select jsonb_build_object(
      'active', count(*) filter (where effective_status not in ('完了', 'キャンセル')),
      'completed', count(*) filter (where effective_status = '完了'),
      'cancelled', count(*) filter (where effective_status = 'キャンセル')
    ) from yearly),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'kanri_no', s.kanri_no, 'kanri_no_raw', s.kanri_no_raw,
        'ordered_on', s.ordered_on, 'customer_name', s.customer_name, 'customer_kana', s.customer_kana,
        'address', s.address, 'acquisition', s.acquisition, 'contract_type', s.contract_type,
        'progress', s.effective_status, 'entered_on', s.entered_on, 'mailed_on', s.mailed_on,
        'sales_name', s.sales_name, 'clerk_name', s.clerk_name,
        'photo_count', coalesce(p.photo_count, 0)
      ) order by s.ordered_on desc, s.fm_pk desc)
      from selected s left join photo_counts p using (kanri_no)
    ), '[]'::jsonb)
  );
$$;

create or replace function public.leaf_kanden_entry_list()
returns jsonb language sql stable set search_path = '' as $$
  with orders as (
    select o.id, o.kanri_no, o.customer_name, o.ordered_on,
      public.leaf_kanden_order_status(o) as effective_status,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on) as search,
      array[o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point] as supply,
      greatest(o.garden_updated_at, o.imported_at, o.flow_updated_at, s.updated_at) as updated_at
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

create or replace function public.leaf_kanden_save_entry(
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
    if greatest(coalesce(before_row.garden_updated_at, before_row.imported_at), before_row.flow_updated_at) is distinct from p_version then
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
      kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, app_sent_on, invoice_sent_on, cancelled_on, acquisition, acquisition_method, sales_name, clerk_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, status, urgent_sw, sw_month, has_denki, has_douryoku, has_gas, payment_received_on, payment_sent_on, completed_on, hold_reason, return_reason, is_direct, jisseki_month, application_received_on, mailed_on, cancel_reason)
    values (after_row.id, 'garden', intake.id, saved_at, p_actor,
      after_row.kanri_no, after_row.kanri_no_raw, after_row.ordered_on, after_row.entered_on, after_row.specs_on, after_row.app_sent_on, after_row.invoice_sent_on, after_row.cancelled_on, after_row.acquisition, after_row.acquisition_method, after_row.sales_name, after_row.clerk_name, after_row.contract_type, after_row.power_apply, after_row.plan, after_row.phone, after_row.denki_customer_no, after_row.denki_supply_point, after_row.douryoku_customer_no, after_row.douryoku_supply_point, after_row.gas_customer_no, after_row.gas_supply_point, after_row.note, after_row.customer_name, after_row.customer_kana, after_row.postal_code, after_row.address, after_row.status, after_row.urgent_sw, after_row.sw_month, after_row.has_denki, after_row.has_douryoku, after_row.has_gas, after_row.payment_received_on, after_row.payment_sent_on, after_row.completed_on, after_row.hold_reason, after_row.return_reason, after_row.is_direct,
      after_row.jisseki_month, after_row.application_received_on, after_row.mailed_on, after_row.cancel_reason);
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
      jisseki_month = after_row.jisseki_month,
      application_received_on = after_row.application_received_on,
      mailed_on = after_row.mailed_on,
      cancel_reason = after_row.cancel_reason,
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

-- Serialize ledger imports and legacy cancellation. Recompute both sides of a changed match.
create function public.leaf_kanden_import_payments(p_rows jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  affected uuid[];
begin
  perform pg_advisory_xact_lock(543, 1);
  select array_agg(distinct id) into affected
  from (
    select r.order_id as id from jsonb_populate_recordset(null::public.leaf_kanden_payments, p_rows) r
    union
    select p.order_id from public.leaf_kanden_payments p
    join jsonb_populate_recordset(null::public.leaf_kanden_payments, p_rows) r using (pd_row_no)
  ) ids where id is not null;

  insert into public.leaf_kanden_payments
    (pd_row_no, statement_month, sales_name, sales_method, customer_name, customer_kana,
     list_flag, acquisition, item, note, sent_on, customer_no, kanri_no, kanri_no_raw,
     amount, order_id, match_note, source_file)
  select pd_row_no, statement_month, sales_name, sales_method, customer_name, customer_kana,
     list_flag, acquisition, item, note, sent_on, customer_no, kanri_no, kanri_no_raw,
     amount, order_id, match_note, source_file
  from jsonb_populate_recordset(null::public.leaf_kanden_payments, p_rows)
  on conflict (pd_row_no) do update set
    statement_month = excluded.statement_month, sales_name = excluded.sales_name,
    sales_method = excluded.sales_method, customer_name = excluded.customer_name,
    customer_kana = excluded.customer_kana, list_flag = excluded.list_flag,
    acquisition = excluded.acquisition, item = excluded.item, note = excluded.note,
    sent_on = excluded.sent_on, customer_no = excluded.customer_no, kanri_no = excluded.kanri_no,
    kanri_no_raw = excluded.kanri_no_raw, amount = excluded.amount, order_id = excluded.order_id,
    match_note = excluded.match_note, source_file = excluded.source_file, imported_at = now()
  where excluded.statement_month >= leaf_kanden_payments.statement_month;

  update public.leaf_kanden_orders o set
    paid_on = summary.paid_on, refunded_on = summary.refunded_on, flow_updated_at = clock_timestamp(),
    status = case when o.status = 'キャンセル' and o.cancel_reason = '郵送前キャンセル（入金なし）'
      and (summary.paid_on is not null or summary.refunded_on is not null) then null else o.status end,
    cancel_reason = case
      when o.cancelled_on is not null then '取消日あり'
      when summary.refunded_on is not null then '戻入あり'
      when o.cancel_reason = '戻入あり' or summary.paid_on is not null then null
      else o.cancel_reason end
  from (
    select ids.id,
      (max(p.statement_month) filter (where p.amount > 0) || '-01')::date as paid_on,
      (max(p.statement_month) filter (where p.amount < 0) || '-01')::date as refunded_on
    from unnest(affected) ids(id)
    left join public.leaf_kanden_payments p on p.order_id = ids.id
    group by ids.id
  ) summary where o.id = summary.id;
end;
$$;

create function public.leaf_kanden_apply_timetree(p_labels jsonb, p_legacy boolean, p_dry_run boolean)
returns jsonb language plpgsql set search_path = '' as $$
declare
  latest date;
  cutoff date;
  labels_count integer;
  cancelled_count integer := 0;
  review_count integer := 0;
  untouched_count integer := 0;
begin
  perform pg_advisory_xact_lock(543, 1);
  if p_legacy then
    select (max(statement_month) || '-01')::date into latest from public.leaf_kanden_payments;
    if latest is null then raise exception 'No payment statements'; end if;
    cutoff := (latest - interval '1 month 1 day')::date;
  end if;

  if p_dry_run then
    select count(*) into labels_count from public.leaf_kanden_orders o
    join jsonb_each_text(p_labels) labels on labels.key = o.kanri_no
    where o.timetree_label is distinct from labels.value;
  else
    update public.leaf_kanden_orders o set timetree_label = labels.value, flow_updated_at = clock_timestamp()
    from jsonb_each_text(p_labels) labels
    where labels.key = o.kanri_no and o.timetree_label is distinct from labels.value;
    get diagnostics labels_count = row_count;
  end if;

  if p_legacy then
    with decisions as materialized (
      select o.id, case
        when o.ordered_on > cutoff or o.ordered_on is null or o.paid_on is not null
          or o.refunded_on is not null or o.cancelled_on is not null or o.status in ('保留', '差し戻し') then null
        when exists (
          select 1 from generate_series(1, 2) as m(offset_month)
          where to_char(o.ordered_on + make_interval(months => m.offset_month), 'YYYY-MM')
            in ('2024-01', '2024-06', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12')
        ) then 'review'
        else 'cancel'
      end as decision
      from public.leaf_kanden_orders o where o.source = 'filemaker'
    ), updates as (
      update public.leaf_kanden_orders o set
        status = case when d.decision = 'cancel' then 'キャンセル' else null end,
        cancel_reason = case when d.decision = 'cancel' then '郵送前キャンセル（入金なし）'
          else '要確認（明細が PDF の月）' end,
        flow_updated_at = clock_timestamp()
      from decisions d where not p_dry_run and o.id = d.id and d.decision is not null
        and o.paid_on is null and o.refunded_on is null and o.cancelled_on is null
        and o.status is distinct from '保留' and o.status is distinct from '差し戻し'
        and (o.status, o.cancel_reason) is distinct from (
          case when d.decision = 'cancel' then 'キャンセル' else null end,
          case when d.decision = 'cancel' then '郵送前キャンセル（入金なし）' else '要確認（明細が PDF の月）' end)
    )
    select count(*) filter (where decision = 'cancel'), count(*) filter (where decision = 'review'),
      count(*) filter (where decision is null)
    into cancelled_count, review_count, untouched_count from decisions;
  end if;
  return jsonb_build_object('labels', labels_count, 'cancelled', cancelled_count,
    'review', review_count, 'untouched', untouched_count, 'cutoff', cutoff);
end;
$$;

revoke execute on function public.leaf_kanden_order_status(public.leaf_kanden_orders),
  public.leaf_kanden_import_payments(jsonb), public.leaf_kanden_apply_timetree(jsonb,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.leaf_kanden_order_status(public.leaf_kanden_orders),
  public.leaf_kanden_import_payments(jsonb), public.leaf_kanden_apply_timetree(jsonb,boolean,boolean)
  to service_role;

commit;
