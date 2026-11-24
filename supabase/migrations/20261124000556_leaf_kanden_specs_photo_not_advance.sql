-- 2026-11-24 東海林さん「諸元の写メは分けるが、ステータスは進めない（諸元が足りない等あるため）」
-- 諸元の写メがあるだけではエントリー待ちにしない。進めるのは諸元回収日（事務の入力・［諸元を添付］）か TimeTree のラベル。
begin;

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
      then 'エントリー待ち'
    else '諸元待ち'
  end;
$$;

update public.leaf_kanden_orders o set computed_status = public.leaf_kanden_order_status(o)
where o.computed_status is distinct from public.leaf_kanden_order_status(o);

commit;
