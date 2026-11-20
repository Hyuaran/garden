begin;

-- invoice_sent_on date already exists (537). Preserve dates entered in Garden.
update public.leaf_kanden_orders
set mailed_on = coalesce(mailed_on, app_sent_on), flow_updated_at = clock_timestamp(),
    status = case when status = 'キャンセル' and cancel_reason = '郵送前キャンセル（入金なし）' then null else status end,
    cancel_reason = case when cancel_reason = '郵送前キャンセル（入金なし）' then null else cancel_reason end
where source = 'filemaker' and (
  (mailed_on is null and app_sent_on is not null)
  or (mailed_on is not null and cancel_reason = '郵送前キャンセル（入金なし）')
);

create index leaf_kanden_submissions_kanri_latest_idx
  on public.leaf_kanden_submissions (kanri_no, submitted_at desc, id) where kanri_no is not null;

create or replace function public.leaf_kanden_order_status(o public.leaf_kanden_orders)
returns text language sql stable set search_path = '' as $$
  select case
    when o.status in ('保留', '差し戻し') then o.status
    when o.cancelled_on is not null or o.refunded_on is not null
      or (o.cancel_reason = '郵送前キャンセル（入金なし）' and o.mailed_on is null and o.paid_on is null) then 'キャンセル'
    when o.paid_on is not null then '完了'
    when o.mailed_on is not null then '入金待ち'
    when o.application_received_on is not null then '郵送待ち'
    when o.entered_on is not null then '申込書待ち'
    when o.specs_on is not null
      or btrim(o.timetree_label, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF') not in ('', '諸元待ち')
      or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
        and p.image_path !~* '\.pdf$' and p.kanri_no = o.kanri_no)
      or exists (select 1 from public.leaf_kanden_photos p where p.category = '諸元'
        and p.image_path !~* '\.pdf$' and p.set_id = case when o.submission_id is not null then (
          select s.set_id from public.leaf_kanden_submissions s where s.id = o.submission_id
        ) else (
          select s.set_id from public.leaf_kanden_submissions s where s.kanri_no = o.kanri_no
          order by s.submitted_at desc, s.id limit 1
        ) end) then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

create function public.leaf_kanden_matches(p_text text, p_values jsonb, p_query jsonb)
returns boolean language sql stable set search_path = '' as $$
  select (
    strpos(lower(normalize(p_text, NFKC)), lower(normalize(btrim(left(coalesce(p_query->>'search', ''), 300)), NFKC))) > 0
    or (
      normalize(p_query->>'search', NFKC) ~ '^[0-9[:space:]+()‐‑‒–—−ー-]+$'
      and strpos(regexp_replace(normalize(p_text, NFKC), '[-‐‑‒–—−ー[:space:]]', '', 'g'),
        nullif(regexp_replace(normalize(left(p_query->>'search', 300), NFKC), '[-‐‑‒–—−ー[:space:]]', '', 'g'), '')) > 0
    )
  ) and not exists (
    select from jsonb_each(case when jsonb_typeof(p_query->'filters') = 'object' then p_query->'filters' else '{}'::jsonb end) f
    where p_values ? f.key and not (f.value ? coalesce(p_values->>f.key, ''))
  );
$$;

create function public.leaf_kanden_entry_page(p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with intake as (
    select s.id, s.kanri_no, s.customer_name, null::date as ordered_on, null::date as invoice_sent_on,
      '受付待ち' as status, s.updated_at, concat_ws(' ', s.kanri_no, s.kanri_no_raw, s.customer_name, s.employee_name) as search
    from public.leaf_kanden_submissions s
    where (p_counts or p_tab = '受付待ち')
      and not exists (select from public.leaf_kanden_orders o where o.submission_id = s.id)
      and not exists (select from public.leaf_kanden_orders o where o.kanri_no = s.kanri_no)
  ), entries as materialized (
    select * from intake
    union all
    select o.id, o.kanri_no, o.customer_name, o.ordered_on, o.invoice_sent_on,
      public.leaf_kanden_order_status(o), greatest(o.garden_updated_at, o.imported_at, o.flow_updated_at, s.updated_at),
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on)
    from public.leaf_kanden_orders o
    left join public.leaf_kanden_submissions s on s.id = o.submission_id
    where p_counts or p_tab <> '受付待ち'
  ), filtered as materialized (
    select e.*, v.fields->>(p_query#>>'{sort,id}') as sort_key
    from entries e
    cross join lateral (select jsonb_build_object('number', kanri_no, 'name', customer_name,
      'date', ordered_on, 'invoice', invoice_sent_on) as fields) v
    where e.status = p_tab and (
      (p_query->>'search' = '' and p_query->'filters' = '{}'::jsonb)
      or public.leaf_kanden_matches(e.search, v.fields, p_query)
    )
  ), numbered as (
    select *, row_number() over (order by
      case when p_query#>>'{sort,direction}' = 'asc' then sort_key end asc nulls last,
      case when p_query#>>'{sort,direction}' = 'desc' then sort_key end desc nulls last,
      ordered_on desc nulls last, updated_at desc, id) as position
    from filtered
  ), page_number as (
    select greatest(1, least((select (count(*) + 49) / 50 from filtered), (p_query->>'page')::integer)) as value
  ), page as (
    select * from numbered order by position limit 50
    offset 50 * ((select value from page_number) - 1)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_array(id, kanri_no, customer_name, ordered_on, status, invoice_sent_on)
      order by position) from page), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', (select value from page_number),
    'counts', case when p_counts then coalesce((select jsonb_object_agg(status, amount)
      from (select status, count(*) as amount from entries group by status) counts), '{}'::jsonb) end,
    'updatedAt', case when p_counts then (select max(updated_at) from entries) end,
    'options', case when p_counts then (select jsonb_build_object(
      'contract_type', array_agg(distinct contract_type order by contract_type) filter (where nullif(contract_type, '') is not null),
      'plan', array_agg(distinct plan order by plan) filter (where nullif(plan, '') is not null),
      'power_apply', array_agg(distinct power_apply order by power_apply) filter (where nullif(power_apply, '') is not null),
      'acquisition_method', array_agg(distinct acquisition_method order by acquisition_method) filter (where nullif(acquisition_method, '') is not null)
    ) from public.leaf_kanden_orders) end
  );
$$;

create function public.leaf_kanden_supply_duplicates(p_id uuid, p_middles text[])
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_object_agg(middle, numbers), '{}'::jsonb)
  from (
    select distinct_middle.middle, array_agg(distinct coalesce(o.kanri_no, '未入力')) as numbers
    from public.leaf_kanden_orders o
    cross join lateral (
      select distinct substring(value from 5 for 14) as middle
      from unnest(array[o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point]) value
      where value ~ '^[0-9]{22}$'
    ) distinct_middle
    where o.id <> p_id and distinct_middle.middle = any(p_middles)
    group by distinct_middle.middle
  ) matches;
$$;

create function public.leaf_kanden_case_page(p_year integer, p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with yearly as materialized (
    select o.*, public.leaf_kanden_order_status(o) as effective_status
    from public.leaf_kanden_orders o
    where (p_counts or p_tab <> 'forms') and o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ), orders as (
    select o.id, o.ordered_on::text as date_key,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.address) as search,
      jsonb_build_object(
        'id', o.id, 'kanri_no', coalesce(o.kanri_no, o.kanri_no_raw), 'kanri_no_raw', o.kanri_no_raw,
        'ordered_on', o.ordered_on,
        'customer_name', o.customer_name, 'acquisition', o.acquisition, 'contract_type', o.contract_type,
        'progress', o.effective_status, 'entered_on', o.entered_on, 'mailed_on', o.mailed_on,
        'invoice_sent_on', o.invoice_sent_on, 'sales_name', o.sales_name, 'clerk_name', o.clerk_name,
        'photo_count', photos.amount
      ) as fields
    from yearly o
    cross join lateral (
      select count(*) as amount from public.leaf_kanden_photos p
      where p.kanri_no = o.kanri_no and p.image_path !~* '\.pdf$'
    ) photos
    where case o.effective_status when '完了' then 'completed' when 'キャンセル' then 'cancelled' else 'active' end = p_tab
  ), intake as materialized (
    select s.id, extract(epoch from s.submitted_at)::text as date_key, s.updated_at,
      concat_ws(' ', s.kanri_no, s.kanri_no_raw, s.customer_name, s.employee_name) as search,
      jsonb_build_object('id', s.id, 'kanri_no', s.kanri_no, 'customer_name', s.customer_name,
        'acquisition', s.acquisition, 'has_denki', s.has_denki, 'has_douryoku', s.has_douryoku,
        'has_gas', s.has_gas, 'sw_month', s.sw_month, 'needs_urgent_sw', s.urgent_sw,
        'products', concat_ws('・', case when s.has_denki then '電灯' end,
          case when s.has_douryoku then '動力' end, case when s.has_gas then 'ガス' end),
        'urgent_sw', case when s.urgent_sw then concat('あり（希望月 ', s.sw_month, '月）') else 'なし' end,
        'specs_status', s.specs_status, 'submitted_at', to_char(s.submitted_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD"T"HH24:MI:SS.US') || '+09:00',
        'employee_name', s.employee_name, 'photo_count', p.photo_count) as fields
    from public.leaf_kanden_submissions s join public.leaf_kanden_photo_sets p on p.id = s.set_id
    where p_tab = 'forms'
      and s.submitted_at >= make_date(p_year, 4, 1)::timestamp at time zone 'Asia/Tokyo'
      and s.submitted_at < make_date(p_year + 1, 4, 1)::timestamp at time zone 'Asia/Tokyo'
  ), filtered as materialized (
    select id, date_key, fields, fields->(p_query#>>'{sort,id}') as sort_key
    from (select id, date_key, fields, search from orders union all
          select id, date_key, fields, search from intake) combined
    where (p_query->>'search' = '' and p_query->'filters' = '{}'::jsonb)
      or public.leaf_kanden_matches(search, fields, p_query)
  ), numbered as (
    select *, row_number() over (order by
      case when p_query#>>'{sort,direction}' = 'asc' then nullif(sort_key, 'null'::jsonb) end asc nulls last,
      case when p_query#>>'{sort,direction}' = 'desc' then nullif(sort_key, 'null'::jsonb) end desc nulls last,
      date_key desc, id) as position
    from filtered
  ), page_number as (
    select greatest(1, least((select (count(*) + 49) / 50 from filtered), (p_query->>'page')::integer)) as value
  ), page as (
    select * from numbered order by position limit 50
    offset 50 * ((select value from page_number) - 1)
  )
  select jsonb_build_object(
    'hasOrders', exists (select from public.leaf_kanden_orders),
    'updatedAt', case when p_counts then greatest(
      (select max(finished_at) from public.leaf_kanden_import_runs where source = 'filemaker'),
      (select max(flow_updated_at) from public.leaf_kanden_orders),
      (select max(garden_updated_at) from public.leaf_kanden_orders)) end,
    'years', case when p_counts then coalesce((
      select jsonb_agg(year order by year desc)
      from (select distinct extract(year from ordered_on - interval '3 months')::int as year
            from public.leaf_kanden_orders where ordered_on is not null) years
    ), '[]'::jsonb) end,
    'counts', case when p_counts then (select jsonb_build_object(
      'active', count(*) filter (where effective_status not in ('完了', 'キャンセル')),
      'completed', count(*) filter (where effective_status = '完了'),
      'cancelled', count(*) filter (where effective_status = 'キャンセル')
    ) from yearly) end,
    'total', (select count(*) from filtered),
    'page', (select value from page_number),
    'withPhotos', (select count(*) from filtered where (fields->>'photo_count')::integer > 0),
    'rows', coalesce((select jsonb_agg(fields order by position) from page where p_tab <> 'forms'), '[]'::jsonb),
    'intake', case when p_tab = 'forms' then coalesce((select jsonb_agg(
      (fields - 'needs_urgent_sw' - 'products') || jsonb_build_object('urgent_sw', fields->'needs_urgent_sw')
      order by position) from page), '[]'::jsonb) end,
    'intakeTotal', case when p_tab = 'forms' then (select count(*) from intake) end,
    'intakeUpdatedAt', case when p_counts then (select max(updated_at) from intake) end
  );
$$;

create or replace function public.leaf_kanden_import_orders(p_rows jsonb)
returns void language sql set search_path = '' as $$
  insert into public.leaf_kanden_orders as existing (fm_pk, kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, mailed_on, invoice_sent_on, cancelled_on, payment_confirmed, fc_result, progress, acquisition, acquisition_method, order_method, sales_name, clerk_name, list_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, billing_amount, fm_created_at, fm_updated_at, imported_at)
  select fm_pk, kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, mailed_on, invoice_sent_on, cancelled_on, payment_confirmed, fc_result, progress, acquisition, acquisition_method, order_method, sales_name, clerk_name, list_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, billing_amount, fm_created_at, fm_updated_at, now()
  from jsonb_populate_recordset(null::public.leaf_kanden_orders, p_rows)
  on conflict (fm_pk) where fm_pk is not null do update
    set kanri_no = excluded.kanri_no,
        kanri_no_raw = excluded.kanri_no_raw,
        ordered_on = excluded.ordered_on,
        entered_on = excluded.entered_on,
        specs_on = excluded.specs_on,
        mailed_on = excluded.mailed_on,
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

create or replace function public.leaf_kanden_apply_timetree(p_labels jsonb, p_legacy boolean, p_dry_run boolean)
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
          or o.mailed_on is not null or o.refunded_on is not null or o.cancelled_on is not null or o.status in ('保留', '差し戻し') then null
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
        and o.mailed_on is null and o.paid_on is null and o.refunded_on is null and o.cancelled_on is null
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

revoke execute on function public.leaf_kanden_matches(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.leaf_kanden_matches(text, jsonb, jsonb) to service_role;
revoke execute on function public.leaf_kanden_entry_page(text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.leaf_kanden_entry_page(text, jsonb, boolean) to service_role;
revoke execute on function public.leaf_kanden_case_page(integer, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.leaf_kanden_case_page(integer, text, jsonb, boolean) to service_role;
revoke execute on function public.leaf_kanden_supply_duplicates(uuid, text[]) from public, anon, authenticated;
grant execute on function public.leaf_kanden_supply_duplicates(uuid, text[]) to service_role;

commit;
