begin;

create table public.leaf_kanden_sales_apply_codes (
  id uuid primary key default gen_random_uuid(),
  employee_id text references public.root_employees(employee_id),
  sales_name text,
  sales_name_key text generated always as (
    regexp_replace(sales_name, U&'[[:space:]\3000\FE00-\FE0F\+0E0100-\+0E01EF]', '', 'g')
  ) stored,
  apply_code text not null check (btrim(apply_code) <> ''),
  starts_on date,
  ends_on date,
  note text,
  check (num_nonnulls(employee_id, sales_name) = 1),
  check (sales_name is null or sales_name_key <> ''),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create index leaf_kanden_sales_apply_codes_employee_idx
  on public.leaf_kanden_sales_apply_codes (employee_id) where employee_id is not null;
create index leaf_kanden_sales_apply_codes_name_idx
  on public.leaf_kanden_sales_apply_codes (sales_name_key) where sales_name_key is not null;

insert into public.leaf_kanden_sales_apply_codes (sales_name, apply_code)
  values ('萩尾拓也', '0281-30101'),
    -- 2026-11-24 Claude が最近の申込書の写メから読み取り（熊野・桐井は写メが不鮮明）
    ('佐藤康太', '0281-30602'),
    ('辻一矢', '0281-30301'),
    ('槙俊介', '0281-30201'),
    ('山根信一', '0281-00009'),
    ('熊野本気', '0281-30604'),
    ('桐井大輔', '0281-30108');

create function public.leaf_kanden_apply_codes_can_read() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.root_employees e
    join public.system_view_scopes s on s.page_key = 'leaf-kanden-entry' and s.tab_key = ''
    left join public.system_view_permissions p on p.page_key = s.page_key and p.tab_key = s.tab_key
    where e.user_id = auth.uid() and e.is_active and e.deleted_at is null
      and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
      and (e.garden_role = 'super_admin'
        or ((now() at time zone 'Asia/Tokyo')::date >= date '2026-12-01'
          and (e.garden_role = any(coalesce(p.roles, s.default_roles)) or e.employee_id = any(p.employee_ids))))
  );
$$;
revoke all on function public.leaf_kanden_apply_codes_can_read() from public, anon;
grant execute on function public.leaf_kanden_apply_codes_can_read() to authenticated;

alter table public.leaf_kanden_sales_apply_codes enable row level security;
revoke all on public.leaf_kanden_sales_apply_codes from public, anon, authenticated;
grant select on public.leaf_kanden_sales_apply_codes to authenticated;
grant select, insert, update, delete on public.leaf_kanden_sales_apply_codes to service_role;
create policy leaf_kanden_sales_apply_codes_read on public.leaf_kanden_sales_apply_codes for select to authenticated
  using ((select public.leaf_kanden_apply_codes_can_read()));

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
        select from public.leaf_kanden_photo_sets s join public.leaf_kanden_photos p on p.set_id = s.id
        where s.set_key = 'entry/' || o.id and p.category = '諸元' and p.image_path !~* '\.pdf$'
      ) then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

create or replace function public.leaf_kanden_refresh_photo_status()
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

  with forms as materialized (
    select id, kanri_no from public.leaf_kanden_submissions where set_id in (old_set, new_set)
  ), affected as (
    select id from public.leaf_kanden_orders where kanri_no in (old_number, new_number)
    union
    select o.id from forms f join public.leaf_kanden_orders o on o.submission_id = f.id
    union
    select o.id from forms f join public.leaf_kanden_orders o on o.kanri_no = f.kanri_no
    where o.submission_id is null and f.id = (
      select s.id from public.leaf_kanden_submissions s where s.kanri_no = o.kanri_no
      order by s.submitted_at desc, s.id limit 1
    )
    union
    select case when s.set_key ~ '^entry/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substring(s.set_key from 7)::uuid end
    from public.leaf_kanden_photo_sets s where s.id in (old_set, new_set)
  )
  update public.leaf_kanden_orders o set computed_status = o.computed_status
  from affected where o.id = affected.id;
  return null;
end;
$$;

-- Recheck existing sets whose prior status used the total count.
update public.leaf_kanden_orders o set computed_status = o.computed_status
where exists (select from public.leaf_kanden_photo_sets s where s.set_key = 'entry/' || o.id and s.photo_count > 0);

commit;
