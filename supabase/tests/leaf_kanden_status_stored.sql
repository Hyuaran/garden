-- Run on a local/test database after migration 554 with one seeded employee.
begin;
set local plpgsql.check_asserts = on;

do $$
declare
  order_id uuid := gen_random_uuid();
  fallback_id uuid := gen_random_uuid();
  form_id uuid := gen_random_uuid();
  newer_form_id uuid := gen_random_uuid();
  photo_id uuid := gen_random_uuid();
  photo_set uuid;
  newer_set uuid;
  employee text;
  number text := '987554001';
  payment_key text := 'codex554-' || order_id;
  lease timestamptz := now() + interval '1 hour';
  query jsonb := '{"page":1,"search":"codex554-fixture","filters":{}}';
  entry_count bigint;
begin
  assert not exists (select from public.leaf_kanden_orders o
    where o.computed_status is distinct from public.leaf_kanden_order_status(o)), 'backfilled status matches original classifier';
  select employee_id into employee from public.root_employees order by employee_id limit 1;
  if employee is null then
    raise exception 'Seed one employee before running this test';
  end if;

  insert into public.leaf_kanden_orders (id, source, kanri_no, ordered_on, customer_name)
  values (order_id, 'garden', number, date '2099-04-02', 'codex554-fixture'),
    (fallback_id, 'timetree', number, date '2099-04-01', 'codex554-fallback');
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'order insert';

  update public.leaf_kanden_orders set specs_on = date '2099-04-02' where id = order_id;
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'order update';
  update public.leaf_kanden_orders set specs_on = null where id = order_id;
  entry_count := coalesce((public.leaf_kanden_entry_page('エントリー待ち', query, true)
    #>> '{counts,エントリー待ち}')::bigint, 0);

  insert into public.leaf_kanden_photo_sets (source, set_key)
  values ('timetree', 'codex554:' || order_id) returning id into photo_set;
  insert into public.leaf_kanden_photos (id, set_id, source, source_key, kanri_no, category, image_path)
  values (photo_id, photo_set, 'timetree', photo_id::text, number, '諸元', 'specs.jpg');
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'photo insert by number';
  assert (public.leaf_kanden_entry_page('エントリー待ち', query, true)#>>'{counts,エントリー待ち}')::bigint
    = entry_count + 2, 'entry count uses stored status';
  assert public.leaf_kanden_entry_page('エントリー待ち', query, false)#>>'{rows,0,4}'
    = 'エントリー待ち', 'entry row uses stored status';
  assert public.leaf_kanden_case_page(2099, 'active', query, true)#>>'{rows,0,progress}'
    = 'エントリー待ち', 'case row uses stored status';

  update public.leaf_kanden_photos set category = '受領' where id = photo_id;
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'photo category removed';
  update public.leaf_kanden_photos set category = '諸元' where id = photo_id;
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'photo category restored';
  update public.leaf_kanden_photos set image_path = 'specs.PDF' where id = photo_id;
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'PDF excluded';
  update public.leaf_kanden_photos set image_path = 'specs.jpg' where id = photo_id;
  delete from public.leaf_kanden_photos where id = photo_id;
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'photo delete';

  insert into public.leaf_kanden_photo_sets (source, set_key, photo_count)
  values ('form', 'entry/' || order_id, 1);
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'entry photo set';
  update public.leaf_kanden_photo_sets set photo_count = 0 where set_key = 'entry/' || order_id;
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'entry photo count cleared';

  perform public.leaf_kanden_apply_timetree(jsonb_build_object(number, 'エントリー待ち'), false, true);
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'TimeTree dry run';
  perform public.leaf_kanden_apply_timetree(jsonb_build_object(number, 'エントリー待ち'), false, false);
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'TimeTree label set';
  perform public.leaf_kanden_apply_timetree(jsonb_build_object(number, '諸元待ち'), false, false);
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'TimeTree label reset';

  update public.leaf_kanden_orders set mailed_on = date '2099-04-02' where id = order_id;
  perform public.leaf_kanden_import_payments(jsonb_build_array(jsonb_build_object(
    'pd_row_no', payment_key, 'statement_month', '2099-05', 'amount', 100, 'order_id', order_id)));
  assert (select computed_status = '完了' from public.leaf_kanden_orders where id = order_id), 'payment import';
  perform public.leaf_kanden_import_payments(jsonb_build_array(jsonb_build_object(
    'pd_row_no', payment_key, 'statement_month', '2099-05', 'amount', 100)));
  assert (select computed_status = '入金待ち' from public.leaf_kanden_orders where id = order_id), 'payment unlinked';
  update public.leaf_kanden_orders set mailed_on = null where id = order_id;

  insert into public.leaf_kanden_form_uploads (id, employee_id, upload_month, locked_until)
  values (form_id, employee, '2099-04', lease);
  perform public.leaf_kanden_commit_form(
    jsonb_build_object('id', form_id, 'employee_id', employee, 'employee_number', '554',
      'employee_name', 'Fixture', 'acquisition', '奪還', 'kanri_no', number,
      'customer_name', 'Fixture', 'has_denki', true, 'has_douryoku', false, 'has_gas', false,
      'urgent_sw', false, 'note', '', 'specs_status', 'あり'),
    jsonb_build_array(jsonb_build_object('path', form_id || '/specs.jpg', 'category', '諸元')),
    null, date '2099-04-02', false, lease);
  assert (select submission_id = form_id and computed_status = 'エントリー待ち'
    from public.leaf_kanden_orders where id = order_id), 'form submission with photos';
  assert (select status = 'エントリー待ち' from public.leaf_kanden_sales_statuses(employee, array[form_id])),
    'sales form uses stored status';

  update public.leaf_kanden_photos set kanri_no = null where source_key = form_id || '/specs.jpg';
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = order_id), 'linked form set';
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = fallback_id), 'fallback form set';

  insert into public.leaf_kanden_photo_sets (source, set_key)
  values ('form', 'form:' || newer_form_id) returning id into newer_set;
  insert into public.leaf_kanden_submissions (id, set_id, employee_id, employee_number, employee_name,
    acquisition, kanri_no, customer_name, has_denki, has_douryoku, has_gas, urgent_sw, note, specs_status, submitted_at)
  values (newer_form_id, newer_set, employee, '554', 'Fixture',
    '奪還', number, 'Fixture', true, false, false, false, '', '諸元待ち', now() + interval '1 day');
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = fallback_id), 'newer form replaces fallback set';
  update public.leaf_kanden_submissions set submitted_at = now() - interval '1 day' where id = newer_form_id;
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = fallback_id), 'form update restores prior set';
  update public.leaf_kanden_submissions set submitted_at = now() + interval '1 day' where id = newer_form_id;
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = fallback_id), 'form update changes latest set';
  delete from public.leaf_kanden_submissions where id = newer_form_id;
  assert (select computed_status = 'エントリー待ち' from public.leaf_kanden_orders where id = fallback_id), 'form delete restores prior set';

  delete from public.leaf_kanden_photos where source_key = form_id || '/specs.jpg';
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = order_id), 'linked photo removed';
  assert (select computed_status = '諸元待ち' from public.leaf_kanden_orders where id = fallback_id), 'fallback photo removed';
  assert not exists (select from public.leaf_kanden_orders o where o.id in (order_id, fallback_id)
    and o.computed_status is distinct from public.leaf_kanden_order_status(o)), 'stored status matches original classifier';
end;
$$;

rollback;
