-- 入金明細が無い昔の受注（郵送済み・2026-09-30 以前に受注・入金待ち）を「明細なし（完了扱い）」で完了にする（2026-11-21 東海林さん）
begin;
create or replace function public.leaf_kanden_order_status(o public.leaf_kanden_orders)
returns text language sql stable set search_path = '' as $$
  select case
    when o.status in ('保留', '差し戻し') then o.status
    when o.cancelled_on is not null or o.refunded_on is not null
      or (o.cancel_reason = '郵送前キャンセル（入金なし）' and o.mailed_on is null and o.paid_on is null) then 'キャンセル'
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
        ) end) then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

update public.leaf_kanden_orders o set cancel_reason = '明細なし（完了扱い）', flow_updated_at = clock_timestamp()
where o.ordered_on <= date '2026-09-30'
  and o.cancel_reason is null
  and public.leaf_kanden_order_status(o) = '入金待ち';

commit;
