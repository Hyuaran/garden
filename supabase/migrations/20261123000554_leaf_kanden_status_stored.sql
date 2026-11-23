begin;

alter table public.leaf_kanden_orders add column computed_status text;

create function public.leaf_kanden_store_order_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.computed_status := public.leaf_kanden_order_status(new);
  return new;
end;
$$;

-- Keep the backfill snapshot stable. If an input writer is active, retry
-- the migration instead of waiting while holding the orders table lock.
lock table public.leaf_kanden_photos, public.leaf_kanden_submissions,
  public.leaf_kanden_photo_sets in share row exclusive mode nowait;

-- Payment imports end by updating the affected orders. TimeTree relabeling
-- also updates the orders directly, so both use this trigger.
create trigger leaf_kanden_store_order_status
before insert or update on public.leaf_kanden_orders
for each row execute function public.leaf_kanden_store_order_status();

update public.leaf_kanden_orders set computed_status = null;
alter table public.leaf_kanden_orders alter column computed_status set not null;
create index leaf_kanden_orders_computed_status_ordered_on_idx
  on public.leaf_kanden_orders (computed_status, ordered_on desc);

create function public.leaf_kanden_refresh_photo_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  old_number text;
  new_number text;
  old_set uuid;
  new_set uuid;
begin
  if tg_op <> 'INSERT' and old.category = '諸元' and old.image_path !~* '\.pdf$' then
    old_number := old.kanri_no;
    old_set := old.set_id;
  end if;
  if tg_op <> 'DELETE' and new.category = '諸元' and new.image_path !~* '\.pdf$' then
    new_number := new.kanri_no;
    new_set := new.set_id;
  end if;
  if (old_number, old_set) is not distinct from (new_number, new_set) then
    return null;
  end if;

  -- An order can see the photo directly or through a linked / fallback form.
  with forms as materialized (
    select id, kanri_no from public.leaf_kanden_submissions where set_id in (old_set, new_set)
  ), affected as (
    select id from public.leaf_kanden_orders where kanri_no in (old_number, new_number)
    union
    select o.id from forms f join public.leaf_kanden_orders o on o.submission_id = f.id
    union
    select o.id from forms f join public.leaf_kanden_orders o on o.kanri_no = f.kanri_no
    where o.submission_id is null
  )
  update public.leaf_kanden_orders o set computed_status = o.computed_status
  from affected where o.id = affected.id;
  return null;
end;
$$;

create trigger leaf_kanden_refresh_photo_status
after insert or update of category, image_path, kanri_no, set_id or delete on public.leaf_kanden_photos
for each row execute function public.leaf_kanden_refresh_photo_status();

create function public.leaf_kanden_refresh_submission_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  old_id uuid;
  new_id uuid;
  old_number text;
  new_number text;
begin
  if tg_op <> 'INSERT' then
    old_id := old.id;
    old_number := old.kanri_no;
  end if;
  if tg_op <> 'DELETE' then
    new_id := new.id;
    new_number := new.kanri_no;
  end if;

  -- Changing the latest form can also affect orders without a submission_id.
  update public.leaf_kanden_orders o set computed_status = o.computed_status
  where o.submission_id in (old_id, new_id)
    or (o.submission_id is null and o.kanri_no in (old_number, new_number));
  return null;
end;
$$;

create trigger leaf_kanden_refresh_submission_status
after insert or update or delete on public.leaf_kanden_submissions
for each row execute function public.leaf_kanden_refresh_submission_status();

create function public.leaf_kanden_refresh_entry_photo_set_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  old_key text;
  new_key text;
begin
  if tg_op <> 'INSERT' and old.photo_count > 0 then
    old_key := old.set_key;
  end if;
  if tg_op <> 'DELETE' and new.photo_count > 0 then
    new_key := new.set_key;
  end if;
  if old_key is not distinct from new_key then
    return null;
  end if;

  update public.leaf_kanden_orders o set computed_status = o.computed_status
  where o.id in (
    select substring(key from 7)::uuid from (values (old_key), (new_key)) as keys(key)
    where key ~ '^entry/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );
  return null;
end;
$$;

create trigger leaf_kanden_refresh_entry_photo_set_status
after insert or update of set_key, photo_count or delete on public.leaf_kanden_photo_sets
for each row execute function public.leaf_kanden_refresh_entry_photo_set_status();

revoke execute on function public.leaf_kanden_store_order_status(),
  public.leaf_kanden_refresh_photo_status(), public.leaf_kanden_refresh_submission_status(),
  public.leaf_kanden_refresh_entry_photo_set_status() from public, anon, authenticated;

create or replace function public.leaf_kanden_entry_page(p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with orders as not materialized (
    select o.id, o.computed_status, o.ordered_on, o.kanri_no, o.customer_name, o.invoice_sent_on, o.sales_name,
      o.mailed_on, coalesce(nullif(btrim(o.jisseki_month), ''), left(o.ordered_on::text, 7)) as month,
      case o.computed_status when '保留' then '差し戻し' else o.computed_status end as status,
      case o.computed_status when '保留' then o.hold_reason when '差し戻し' then o.return_reason else o.cancel_reason end as reason,
      greatest(o.garden_updated_at, o.imported_at, o.flow_updated_at, f.updated_at) as updated_at,
      case when p_query ? 'requests' then (to_jsonb(o) - 'entry_list_values' - 'application_fields' - 'computed_status') || o.application_fields end as criteria,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on) as search
    from public.leaf_kanden_orders o
    left join public.leaf_kanden_submissions f on f.id = o.submission_id
  ), filtered as materialized (
    select e.*, v.fields->>(p_query#>>'{sort,id}') as sort_key
    from orders e
    cross join lateral (select jsonb_build_object('number', kanri_no, 'name', customer_name,
      'date', ordered_on, 'invoice', invoice_sent_on, 'reason', reason, 'sales_name', sales_name,
      'month', month, 'status', status, 'mailed_on', mailed_on) as fields) v
    where (p_tab = '一覧' or e.computed_status = case when p_tab = '保留' then null else p_tab end
      or (p_tab = '差し戻し' and e.computed_status = '保留'))
      and case when coalesce(p_query->>'search', '') = ''
        and coalesce(p_query->'filters', '{}'::jsonb) = '{}'::jsonb then true
        else public.leaf_kanden_matches(concat_ws(' ', e.search, e.reason), v.fields, p_query) end
      and (not (p_query ? 'requests') or public.leaf_kanden_entry_matches_search(
        e.criteria || v.fields || jsonb_build_object('jisseki_month', e.month), p_query
      ))
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
    'rows', coalesce((select jsonb_agg(jsonb_build_array(id, kanri_no, customer_name, ordered_on, status,
      invoice_sent_on, sales_name, month, mailed_on, reason) order by position) from page), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'page', (select value from page_number),
    'counts', case when p_counts then coalesce((select jsonb_object_agg(status, amount)
      from (select case computed_status when '保留' then '差し戻し' else computed_status end as status,
        count(*) as amount from public.leaf_kanden_orders group by 1) counts), '{}'::jsonb) end,
    'updatedAt', case when p_counts then (select max(updated_at) from orders) end,
    'options', case when p_counts then (select jsonb_build_object(
      'reason', (select array_agg(distinct coalesce(reason, '') order by coalesce(reason, '')) from orders),
      'sales_name', (select array_agg(distinct coalesce(sales_name, '') order by coalesce(sales_name, '')) from orders),
      'month', (select array_agg(distinct coalesce(month, '') order by coalesce(month, '')) from orders),
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
    select o.*
    from public.leaf_kanden_orders o
    where (p_counts or p_tab <> 'forms') and o.ordered_on >= make_date(p_year, 4, 1)
      and o.ordered_on < make_date(p_year + 1, 4, 1)
  ), tab_orders as (
    select * from yearly
    where case computed_status when '完了' then 'completed' when 'キャンセル' then 'cancelled' else 'active' end = p_tab
  ), orders as (
    select o.id, o.ordered_on::text as date_key,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.address, o.cancel_reason) as search,
      jsonb_build_object(
        'id', o.id, 'kanri_no', coalesce(o.kanri_no, o.kanri_no_raw), 'kanri_no_raw', o.kanri_no_raw,
        'ordered_on', o.ordered_on,
        'customer_name', o.customer_name, 'acquisition', o.acquisition, 'contract_type', o.contract_type,
        'progress', o.computed_status, 'cancel_reason', o.cancel_reason, 'entered_on', o.entered_on, 'mailed_on', o.mailed_on,
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
      'active', count(*) filter (where computed_status not in ('完了', 'キャンセル')),
      'completed', count(*) filter (where computed_status = '完了'),
      'cancelled', count(*) filter (where computed_status = 'キャンセル')
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

create or replace function public.leaf_kanden_sales_statuses(p_employee text, p_ids uuid[])
returns table (id uuid, status text)
language sql stable set search_path = '' as $$
  select s.id, case linked.order_status
    when '保留' then '差し戻し'
    else coalesce(linked.order_status, '受付待ち')
  end
  from public.leaf_kanden_submissions s
  left join lateral (
    select candidate.computed_status as order_status
    from public.leaf_kanden_orders candidate
    where candidate.submission_id = s.id
      or (candidate.submission_id is null and candidate.kanri_no = s.kanri_no)
    order by (candidate.submission_id is not null) desc, candidate.ordered_on desc nulls last, candidate.id
    limit 1
  ) linked on true
  where s.employee_id = p_employee and s.id = any(p_ids);
$$;

commit;
