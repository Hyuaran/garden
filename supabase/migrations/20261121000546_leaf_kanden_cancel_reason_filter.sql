begin;

-- Keep the existing RPC signatures and execute privileges.
create or replace function public.leaf_kanden_entry_page(p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with intake as (
    select s.id, s.kanri_no, s.customer_name, null::date as ordered_on, null::date as invoice_sent_on,
      '受付待ち' as status, s.updated_at, null::text as cancel_reason, concat_ws(' ', s.kanri_no, s.kanri_no_raw, s.customer_name, s.employee_name) as search
    from public.leaf_kanden_submissions s
    where (p_counts or p_tab = '受付待ち')
      and not exists (select from public.leaf_kanden_orders o where o.submission_id = s.id)
      and not exists (select from public.leaf_kanden_orders o where o.kanri_no = s.kanri_no)
  ), entries as materialized (
    select * from intake
    union all
    select o.id, o.kanri_no, o.customer_name, o.ordered_on, o.invoice_sent_on,
      public.leaf_kanden_order_status(o), greatest(o.garden_updated_at, o.imported_at, o.flow_updated_at, s.updated_at), o.cancel_reason,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on, o.cancel_reason)
    from public.leaf_kanden_orders o
    left join public.leaf_kanden_submissions s on s.id = o.submission_id
    where p_counts or p_tab <> '受付待ち'
  ), filtered as materialized (
    select e.*, v.fields->>(p_query#>>'{sort,id}') as sort_key
    from entries e
    cross join lateral (select jsonb_build_object('number', kanri_no, 'name', customer_name,
      'date', ordered_on, 'invoice', invoice_sent_on, 'reason', cancel_reason) as fields) v
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
      'reason', (select coalesce(jsonb_agg(reason order by reason), '[]'::jsonb)
        from (select distinct coalesce(cancel_reason, '') as reason from entries) reasons),
      'contract_type', array_agg(distinct contract_type order by contract_type) filter (where nullif(contract_type, '') is not null),
      'plan', array_agg(distinct plan order by plan) filter (where nullif(plan, '') is not null),
      'power_apply', array_agg(distinct power_apply order by power_apply) filter (where nullif(power_apply, '') is not null),
      'acquisition_method', array_agg(distinct acquisition_method order by acquisition_method) filter (where nullif(acquisition_method, '') is not null)
    ) from public.leaf_kanden_orders) end
  );
$$;

create or replace function public.leaf_kanden_case_page(p_year integer, p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with yearly as materialized (
    select o.*, public.leaf_kanden_order_status(o) as effective_status
    from public.leaf_kanden_orders o
    where (p_counts or p_tab <> 'forms') and o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ), tab_orders as (
    select * from yearly
    where case effective_status when '完了' then 'completed' when 'キャンセル' then 'cancelled' else 'active' end = p_tab
  ), orders as (
    select o.id, o.ordered_on::text as date_key,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.address, o.cancel_reason) as search,
      jsonb_build_object(
        'id', o.id, 'kanri_no', coalesce(o.kanri_no, o.kanri_no_raw), 'kanri_no_raw', o.kanri_no_raw,
        'ordered_on', o.ordered_on,
        'customer_name', o.customer_name, 'acquisition', o.acquisition, 'contract_type', o.contract_type,
        'progress', o.effective_status, 'cancel_reason', o.cancel_reason, 'entered_on', o.entered_on, 'mailed_on', o.mailed_on,
        'invoice_sent_on', o.invoice_sent_on, 'sales_name', o.sales_name, 'clerk_name', o.clerk_name,
        'photo_count', photos.amount
      ) as fields
    from tab_orders o
    cross join lateral (
      select count(*) as amount from public.leaf_kanden_photos p
      where p.kanri_no = o.kanri_no and p.image_path !~* '\.pdf$'
    ) photos
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
    'options', case when p_counts and p_tab <> 'forms' then jsonb_build_object(
      'cancel_reason', (select coalesce(jsonb_agg(reason order by reason), '[]'::jsonb)
        from (select distinct coalesce(cancel_reason, '') as reason from tab_orders) reasons)
    ) end,
    'withPhotos', (select count(*) from filtered where (fields->>'photo_count')::integer > 0),
    'rows', coalesce((select jsonb_agg(fields order by position) from page where p_tab <> 'forms'), '[]'::jsonb),
    'intake', case when p_tab = 'forms' then coalesce((select jsonb_agg(
      (fields - 'needs_urgent_sw' - 'products') || jsonb_build_object('urgent_sw', fields->'needs_urgent_sw')
      order by position) from page), '[]'::jsonb) end,
    'intakeTotal', case when p_tab = 'forms' then (select count(*) from intake) end,
    'intakeUpdatedAt', case when p_counts then (select max(updated_at) from intake) end
  );
$$;

commit;
