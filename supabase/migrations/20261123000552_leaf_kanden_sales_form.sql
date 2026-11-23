begin;

alter table public.leaf_kanden_submissions add column customer_fields jsonb;

create function public.leaf_kanden_sales_lookup(p_number text, p_branch text)
returns table (customer_name text, customer_kana text, address1 text, address2 text,
  phone1 text, phone2 text, mobile text, customer_no text, supply_point text, contract_type text, list_name text)
language sql stable set search_path = '' as $$
  select l.customer_name, l.customer_kana, l.address1, l.address2, l.phone1, l.phone2,
    l.mobile, l.customer_no, l.supply_point, l.contract_type, l.list_name
  from public.soil_kanden_list l
  cross join lateral (
    select substring(translate(rtrim(l.kanri_no_raw), '０１２３４５６７８９（）　', '0123456789() ')
      from '\(([0-9]+)\)[[:space:]]*$') as branch
  ) raw
  where l.kanri_no = p_number and coalesce(raw.branch, '') = p_branch
  order by l.fm_updated_on desc nulls last, l.fm_rowid desc
  limit 1;
$$;

create function public.leaf_kanden_sales_statuses(p_employee text, p_ids uuid[])
returns table (id uuid, status text)
language sql stable set search_path = '' as $$
  select s.id, case linked.order_status
    when '保留' then '差し戻し'
    else coalesce(linked.order_status, '受付待ち')
  end
  from public.leaf_kanden_submissions s
  left join lateral (
    select public.leaf_kanden_order_status(candidate) as order_status
    from public.leaf_kanden_orders candidate
    where candidate.submission_id = s.id
      or (candidate.submission_id is null and candidate.kanri_no = s.kanri_no)
    order by (candidate.submission_id is not null) desc, candidate.ordered_on desc nulls last, candidate.id
    limit 1
  ) linked on true
  where s.employee_id = p_employee and s.id = any(p_ids);
$$;

create function public.leaf_kanden_sales_month(p_employee text)
returns table (sent bigint, completed bigint, awaiting bigint, urgent bigint)
language sql stable set search_path = '' as $$
  with month_rows as materialized (
    select s.id, s.specs_status, s.urgent_sw
    from public.leaf_kanden_submissions s
    where s.employee_id = p_employee and s.submitted_at >=
      (date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo')
  )
  select count(*), count(*) filter (where status.status = '完了'),
    count(*) filter (where status.status = '諸元待ち'
      or (status.status = '受付待ち' and m.specs_status = '諸元待ち')),
    count(*) filter (where m.urgent_sw)
  from month_rows m
  left join public.leaf_kanden_sales_statuses(p_employee, array(select id from month_rows)) status on status.id = m.id;
$$;

revoke execute on function public.leaf_kanden_sales_month(text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_sales_month(text) to service_role;
revoke execute on function public.leaf_kanden_sales_lookup(text,text) from public, anon, authenticated;
revoke execute on function public.leaf_kanden_sales_statuses(text,uuid[]) from public, anon, authenticated;
grant execute on function public.leaf_kanden_sales_lookup(text,text) to service_role;
grant execute on function public.leaf_kanden_sales_statuses(text,uuid[]) to service_role;


create or replace function public.leaf_kanden_commit_form(
  p_submission jsonb, p_photos jsonb, p_pdf text, p_date date, p_append boolean, p_lock timestamptz
) returns void language plpgsql set search_path = public as $$
declare
  form leaf_kanden_submissions := jsonb_populate_record(null::leaf_kanden_submissions, p_submission);
  target_set uuid;
begin
  perform 1 from leaf_kanden_form_uploads
    where id = form.id and employee_id = form.employee_id and locked_until = p_lock and locked_until > now()
    for update;
  if not found then raise exception 'Invalid submission lease'; end if;

  if p_append then
    update leaf_kanden_submissions set specs_status = 'あり', updated_at = now()
      where id = form.id and employee_id = form.employee_id
      returning set_id into strict target_set;
  else
    insert into leaf_kanden_photo_sets (source, set_key, kanri_no, event_date)
      values ('form', 'form:' || form.id, form.kanri_no, p_date) returning id into target_set;
    form.set_id := target_set;
    form.submitted_at := now();
    form.updated_at := now();
    insert into leaf_kanden_submissions select (form).*;
  end if;

  insert into leaf_kanden_photos (set_id, source, source_key, kanri_no, event_date, category, width, height, bytes, image_path)
    select target_set, 'form', photo.path, form.kanri_no, p_date, photo.category,
      photo.width, photo.height, photo.bytes, photo.path
    from jsonb_to_recordset(p_photos) as photo(path text, category text, width int, height int, bytes int);

  update leaf_kanden_photo_sets set pdf_path = p_pdf, updated_at = now(),
    photo_count = photo_count + jsonb_array_length(p_photos) where id = target_set;
end;
$$;

create or replace function public.leaf_kanden_reserve_specs_slots(p_id uuid, p_employee text)
returns integer language sql set search_path = public as $$
  update leaf_kanden_form_uploads as upload
    set next_specs_index = upload.next_specs_index + 10000
  where upload.id = p_id and upload.employee_id = p_employee
    and exists (
      select 1 from leaf_kanden_submissions where id = p_id and employee_id = p_employee
    )
  returning upload.next_specs_index - 10000;
$$;

commit;
