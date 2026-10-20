-- 本文 v2 専用。既存の画面/PDF の集計は変更しない。運用担当者が適用する。
begin;
create index if not exists idx_system_call_history_report_confirm_sales
  on public.system_call_history ((nullif(btrim(external_sales_id), '')), call_date, call_time)
  where btrim(result_flag) in ('前確OK','前確NG');
create or replace function public.system_call_report_counts(p_from date, p_to date, p_as_of timestamptz, p_lp_circuit_ids integer[])
returns jsonb language sql stable security definer set search_path = public as $$
with authorized as (
  select coalesce(auth.role() = 'service_role', false)
    or coalesce(public.garden_role_of(auth.uid()) in ('manager','admin','super_admin'), false) as allowed
), today as (
  select h.external_call_id as id, nullif(btrim(h.external_sales_id), '') as sales_id,
    btrim(h.result_flag) as flag, h.call_date as date, h.call_time as time
  from public.system_call_history h, authorized a
  where a.allowed and h.call_date between p_from and p_to
    and btrim(h.result_flag) in ('獲得','前確OK','前確NG')
    and (h.call_date + coalesce(h.call_time, time '00:00')) at time zone 'Asia/Tokyo' <= p_as_of
), acquired as (
  select distinct sales_id from today where flag = '獲得' and sales_id is not null
), confirmed_sales as (
  select a.sales_id from acquired a
  where exists (
    select 1 from public.system_call_history h
    where nullif(btrim(h.external_sales_id), '') = a.sales_id
      and btrim(h.result_flag) in ('前確OK','前確NG')
      and h.call_date <= (p_as_of at time zone 'Asia/Tokyo')::date
      and (h.call_date + coalesce(h.call_time, time '00:00')) at time zone 'Asia/Tokyo' <= p_as_of
  )
), phones as (
  select distinct c.circuit_id,
    case when c.call_type = 1 then c.caller_num_norm else c.callee_num_norm end as number
  from public.system_innovera_call c, authorized a
  where a.allowed and c.call_type in (1,2) and c.circuit_id = any(p_lp_circuit_ids)
    and c.start_time >= p_from::timestamp at time zone 'Asia/Tokyo'
    and c.start_time < (p_to + 1)::timestamp at time zone 'Asia/Tokyo'
    and c.start_time <= p_as_of
)
select case when not (select allowed from authorized) then jsonb_build_object('authorized',false)
else jsonb_build_object('authorized',true,
 'telema_events',coalesce((select jsonb_agg(to_jsonb(today)) from today),'[]'::jsonb),
 'confirmed_sales',coalesce((select jsonb_agg(sales_id) from confirmed_sales),'[]'::jsonb),
 'phones',coalesce((select jsonb_agg(to_jsonb(phones)) from phones where number ~ '^0[0-9]{8,}$'),'[]'::jsonb)) end;
$$;
revoke all on function public.system_call_report_counts(date,date,timestamptz,integer[]) from public, anon;
grant execute on function public.system_call_report_counts(date,date,timestamptz,integer[]) to authenticated, service_role;
commit;
