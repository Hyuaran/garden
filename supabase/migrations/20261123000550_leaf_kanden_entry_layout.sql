begin;
alter table public.leaf_kanden_orders
  add column application_fields jsonb not null default '{}'::jsonb,
  add column entry_list_values jsonb;

create function public.leaf_kanden_create_form_order()
returns trigger language plpgsql set search_path = '' as $$
declare existing_order uuid;
begin
  if new.kanri_no is not null then
    perform pg_advisory_xact_lock(550, 1);
    select id into existing_order from public.leaf_kanden_orders where kanri_no = new.kanri_no
      order by ordered_on desc nulls last, id limit 1 for update;
    if existing_order is not null then
      update public.leaf_kanden_orders set submission_id = new.id where id = existing_order and submission_id is null;
      return new;
    end if;
  end if;
  insert into public.leaf_kanden_orders
    (source, submission_id, kanri_no, kanri_no_raw, customer_name, acquisition, urgent_sw, sw_month,
      has_denki, has_douryoku, has_gas, note, sales_name, ordered_on)
    values ('garden', new.id, new.kanri_no, new.kanri_no_raw, new.customer_name, new.acquisition,
      new.urgent_sw, new.sw_month, new.has_denki, new.has_douryoku, new.has_gas, new.note,
      new.employee_name, (new.submitted_at at time zone 'Asia/Tokyo')::date);
  return new;
end;
$$;
create trigger leaf_kanden_create_form_order after insert on public.leaf_kanden_submissions
for each row execute function public.leaf_kanden_create_form_order();

create function public.leaf_kanden_entry_condition(actual text, term text, field text)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  value text := btrim(term);
  boundary text;
  op text;
  negate boolean := false;
  matched boolean;
begin
  actual := coalesce(actual, '');
  while left(value, 1) = '!' loop
    negate := not negate;
    value := btrim(substr(value, 2));
  end loop;
  if field in ('ordered_on','specs_on','entered_on','application_received_on','mailed_on',
    'invoice_sent_on','cancelled_on','apply_date','jisseki_month','paid_on','completed_on') then
    actual := replace(actual, '/', '-');
    if value <> '//' then value := replace(value, '/', '-'); end if;
  end if;
  op := substring(value from '^(==|>=|<=|>|<)');
  boundary := substr(value, length(op) + 1);
  matched := case
    when value = '' then true
    when value = '//' then actual = ((now() at time zone 'Asia/Tokyo')::date)::text
    when left(value, 2) = chr(92) || '=' then strpos(actual, substr(value, 2)) > 0
    when op = '==' then actual = boundary
    when op = '>=' then actual >= boundary
    when op = '<=' then actual <= boundary
    when op = '>' then actual > boundary
    when op = '<' then actual < boundary
    when strpos(value, '...') > 0 then actual between btrim(split_part(value,'...',1)) and btrim(split_part(value,'...',2))
    when strpos(value, '*') > 0 then lower(actual) like replace(
      replace(replace(replace(lower(ltrim(value, '=')), chr(92), chr(92)||chr(92)),
        '%', chr(92)||'%'), '_', chr(92)||'_'), '*', '%')
    else starts_with(lower(actual), lower(ltrim(value, '=')))
  end;
  return matched <> negate;
end;
$$;

create function public.leaf_kanden_entry_matches_requests(fields jsonb, requests jsonb)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select from jsonb_array_elements(requests) request(value)
    where not exists (
      select from jsonb_each_text(request.value) criterion
      where not public.leaf_kanden_entry_condition(fields->>criterion.key, criterion.value, criterion.key)
    )
  );
$$;

create function public.leaf_kanden_entry_matches_search(fields jsonb, query jsonb)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  matched boolean;
  refinement jsonb;
begin
  if not (query ? 'requests') then return true; end if;
  matched := public.leaf_kanden_entry_matches_requests(fields, query->'requests');
  for refinement in select value from jsonb_array_elements(coalesce(query->'refinements', '[]'::jsonb)) loop
    if refinement->>'mode' = 'extend' then
      matched := matched or public.leaf_kanden_entry_matches_requests(fields, refinement->'requests');
    else
      matched := matched and public.leaf_kanden_entry_matches_requests(fields, refinement->'requests');
    end if;
  end loop;
  return matched;
end;
$$;

create or replace function public.leaf_kanden_entry_page(p_tab text, p_query jsonb, p_counts boolean)
returns jsonb language sql stable set search_path = '' as $$
  with orders as materialized (
    select o.id, o.ordered_on, o.kanri_no, o.customer_name, o.invoice_sent_on, o.sales_name,
      o.mailed_on, coalesce(nullif(btrim(o.jisseki_month), ''), left(o.ordered_on::text, 7)) as month,
      case s.status when '保留' then '差し戻し' else s.status end as status,
      case s.status when '保留' then o.hold_reason when '差し戻し' then o.return_reason else o.cancel_reason end as reason,
      greatest(o.garden_updated_at, o.imported_at, o.flow_updated_at, f.updated_at) as updated_at,
      case when p_query ? 'requests' then (to_jsonb(o) - 'entry_list_values' - 'application_fields') || o.application_fields end as criteria,
      concat_ws(' ', o.kanri_no, o.kanri_no_raw, o.customer_name, o.customer_kana, o.postal_code,
        o.address, o.phone, o.denki_supply_point, o.douryoku_supply_point, o.gas_supply_point,
        o.denki_customer_no, o.douryoku_customer_no, o.gas_customer_no, o.sales_name, o.ordered_on) as search
    from public.leaf_kanden_orders o
    left join public.leaf_kanden_submissions f on f.id = o.submission_id
    cross join lateral (select public.leaf_kanden_order_status(o) as status) s
  ), filtered as materialized (
    select e.*, v.fields->>(p_query#>>'{sort,id}') as sort_key
    from orders e
    cross join lateral (select jsonb_build_object('number', kanri_no, 'name', customer_name,
      'date', ordered_on, 'invoice', invoice_sent_on, 'reason', reason, 'sales_name', sales_name,
      'month', month, 'status', status, 'mailed_on', mailed_on) as fields) v
    where (p_tab = '一覧' or e.status = p_tab)
      and public.leaf_kanden_matches(concat_ws(' ', e.search, e.reason), v.fields, p_query)
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
      from (select status, count(*) as amount from orders group by status) counts), '{}'::jsonb) end,
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

revoke execute on function public.leaf_kanden_create_form_order() from public, anon, authenticated;
revoke execute on function public.leaf_kanden_entry_condition(text, text, text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_entry_condition(text, text, text) to service_role;
revoke execute on function public.leaf_kanden_entry_matches_requests(jsonb, jsonb),
  public.leaf_kanden_entry_matches_search(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.leaf_kanden_entry_matches_requests(jsonb, jsonb),
  public.leaf_kanden_entry_matches_search(jsonb, jsonb) to service_role;
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
      kanri_no, kanri_no_raw, ordered_on, entered_on, specs_on, app_sent_on, invoice_sent_on, cancelled_on, acquisition, acquisition_method, sales_name, clerk_name, contract_type, power_apply, plan, phone, denki_customer_no, denki_supply_point, douryoku_customer_no, douryoku_supply_point, gas_customer_no, gas_supply_point, note, customer_name, customer_kana, postal_code, address, status, urgent_sw, sw_month, has_denki, has_douryoku, has_gas, payment_received_on, payment_sent_on, completed_on, hold_reason, return_reason, is_direct, jisseki_month, application_received_on, mailed_on, cancel_reason, application_fields)
    values (after_row.id, 'garden', intake.id, saved_at, p_actor,
      after_row.kanri_no, after_row.kanri_no_raw, after_row.ordered_on, after_row.entered_on, after_row.specs_on, after_row.app_sent_on, after_row.invoice_sent_on, after_row.cancelled_on, after_row.acquisition, after_row.acquisition_method, after_row.sales_name, after_row.clerk_name, after_row.contract_type, after_row.power_apply, after_row.plan, after_row.phone, after_row.denki_customer_no, after_row.denki_supply_point, after_row.douryoku_customer_no, after_row.douryoku_supply_point, after_row.gas_customer_no, after_row.gas_supply_point, after_row.note, after_row.customer_name, after_row.customer_kana, after_row.postal_code, after_row.address, after_row.status, after_row.urgent_sw, after_row.sw_month, after_row.has_denki, after_row.has_douryoku, after_row.has_gas, after_row.payment_received_on, after_row.payment_sent_on, after_row.completed_on, after_row.hold_reason, after_row.return_reason, after_row.is_direct,
      after_row.jisseki_month, after_row.application_received_on, after_row.mailed_on, after_row.cancel_reason, coalesce(after_row.application_fields, '{}'::jsonb));
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
      application_fields = after_row.application_fields,
      entry_list_values = coalesce(before_row.entry_list_values,
        to_jsonb(before_row) - 'entry_list_values' - 'application_fields'),
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

create function public.leaf_kanden_attach_entry_specs(p_order uuid, p_paths text[], p_actor text)
returns void language plpgsql set search_path = '' as $$
declare
  target public.leaf_kanden_orders;
  set_uuid uuid;
  saved_at timestamptz := clock_timestamp();
  specs_date date := (saved_at at time zone 'Asia/Tokyo')::date;
begin
  select * into strict target from public.leaf_kanden_orders where id = p_order for update;
  if cardinality(p_paths) not between 1 and 10 or exists (
    select from unnest(p_paths) p(path)
    where not starts_with(p.path, 'entry/' || p_order || '/') or not exists (
      select from storage.objects s where s.bucket_id = 'leaf-kanden-photos' and s.name = p.path
        and s.metadata->>'mimetype' = 'image/jpeg' and (s.metadata->>'size')::bigint between 1 and 10485760
    )
  ) then raise exception 'Invalid specifications photos'; end if;
  insert into public.leaf_kanden_photo_sets (source, set_key, kanri_no, event_date)
    values ('form', 'entry/' || p_order, target.kanri_no, specs_date)
    on conflict (set_key) do update set updated_at = excluded.updated_at
    returning id into set_uuid;
  insert into public.leaf_kanden_photos (set_id, source, source_key, event_date, category, image_path)
    select set_uuid, 'form', path, specs_date, '諸元', path from unnest(p_paths) p(path)
    on conflict (source_key) do nothing;
  update public.leaf_kanden_photo_sets set photo_count = (
    select count(*) from public.leaf_kanden_photos where set_id = set_uuid
  ) where id = set_uuid;
  if target.specs_on is null then
    update public.leaf_kanden_orders set specs_on = specs_date, garden_updated_at = saved_at, garden_updated_by = p_actor
      where id = p_order;
    insert into public.leaf_kanden_order_history (order_id, changed_at, changed_by, field, old_value, new_value)
      values (p_order, saved_at, p_actor, 'specs_on', null, to_jsonb(specs_date));
  else
    update public.leaf_kanden_orders set garden_updated_at = saved_at, garden_updated_by = p_actor where id = p_order;
  end if;
end;
$$;
revoke execute on function public.leaf_kanden_attach_entry_specs(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_attach_entry_specs(uuid, text[], text) to service_role;

create or replace function public.leaf_kanden_import_orders(p_rows jsonb)
returns void language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(550, 1);
  -- The same management number now exists before FileMaker first sees it.
  -- Keep the Garden order ID, clerk edits, submission, payment links and history.
  with incoming as (
    select r.*, count(*) over (partition by r.kanri_no) as matches
    from jsonb_populate_recordset(null::public.leaf_kanden_orders, p_rows) r
    where r.kanri_no is not null and r.fm_pk is not null
  )
  update public.leaf_kanden_orders g set
    fm_pk = r.fm_pk,
    entry_list_values = case when g.garden_updated_at is not null then
      to_jsonb(r) - 'entry_list_values' - 'application_fields' - 'matches'
    end,
    flow_updated_at = clock_timestamp()
  from incoming r
  where g.kanri_no = r.kanri_no and g.source = 'garden' and g.submission_id is not null
    and g.fm_pk is null and r.matches = 1
    and not exists (select from public.leaf_kanden_orders e
      where e.fm_pk = r.fm_pk or (e.kanri_no = r.kanri_no and e.source = 'filemaker'));
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
end;
$$;

create or replace function public.leaf_kanden_order_status(o public.leaf_kanden_orders)
returns text language sql stable set search_path = '' as $$
  select case
    when o.status in ('保留', '差し戻し') then o.status
    when o.cancelled_on is not null or o.refunded_on is not null
      or (o.cancel_reason = '郵送前キャンセル（入金なし）' and o.mailed_on is null and o.paid_on is null)
      or (o.cancel_reason = '請求前キャンセル（TimeTree）' and o.paid_on is null) then 'キャンセル'
    when o.paid_on is not null or (o.cancel_reason = '明細なし（完了扱い）' and o.mailed_on is not null) then '完了'
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
        ) end)
      or exists (
        select from public.leaf_kanden_photo_sets s
        where s.set_key = 'entry/' || o.id and s.photo_count > 0
      ) then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

commit;
