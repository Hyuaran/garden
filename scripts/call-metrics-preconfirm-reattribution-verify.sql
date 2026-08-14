-- Run after 20260814000002 in Supabase SQL Editor (service_role or manager session).
-- Set the range once here. The first result must have all three counts equal.
with params as (
  select date '2025-08-14' as from_date, date '2026-08-14' as to_date
), payload as (
  select public.system_call_metrics(from_date, to_date, null, null) as value
  from params
), employee_total as (
  select coalesce(sum(x.order_count), 0)::bigint as count
  from payload, jsonb_to_recordset(value->'employee_metrics') as x(order_count bigint)
), list_total as (
  select coalesce(sum(x.order_count), 0)::bigint as count
  from payload, jsonb_to_recordset(value->'metrics') as x(order_count bigint)
), raw_total as (
  select count(*)::bigint as count
  from public.system_call_history h, params
  where h.result_flag = '前確OK' and h.call_date between from_date and to_date
)
select raw_total.count as raw_preconfirm_count,
  employee_total.count as employee_preconfirm_sum,
  list_total.count as list_preconfirm_sum,
  raw_total.count = employee_total.count
    and raw_total.count = list_total.count as totals_match
from raw_total, employee_total, list_total;

-- Diagnostic: orphan rows fall back to the preconfirm row's own employee/list.
with params as (
  select date '2025-08-14' as from_date, date '2026-08-14' as to_date
)
select count(*)::bigint as orphan_preconfirm_count
from public.system_call_history p, params
where p.result_flag = '前確OK'
  and p.call_date between from_date and to_date
  and (
    p.external_sales_id is null
    or btrim(p.external_sales_id) = ''
    or not exists (
      select 1 from public.system_call_history a
      where a.result_flag = '獲得' and a.external_sales_id = p.external_sales_id
    )
  );

-- Regression examples from the production investigation.
select external_sales_id, result_flag, employee_name, list_name, call_date, call_time, id
from public.system_call_history
where external_sales_id in ('2021866', '2012287', '1444380')
  and result_flag in ('獲得', '前確OK')
order by external_sales_id, call_date, call_time, id;

-- A preconfirm-only key must remain present with call_count=0 and a finite 0 rate.
with params as (
  select date '2025-08-14' as from_date, date '2026-08-14' as to_date
), payload as (
  select public.system_call_metrics(from_date, to_date, null, null) as value from params
)
select employee_name, call_count, order_count, call_order_rate
from payload, jsonb_to_recordset(value->'employee_metrics') as x(
  employee_name text, call_count bigint, order_count bigint, call_order_rate numeric
)
where call_count = 0 and order_count > 0;

-- Required performance check: Execution Time must be below 8000 ms.
explain (analyze, buffers)
select public.system_call_metrics(date '2025-08-14', date '2026-08-14', null, null);

-- Both partial indexes must be valid before measuring.
select indexrelid::regclass as index_name, indisvalid, indisready
from pg_index
where indexrelid in (
  'public.idx_system_call_history_preconfirm_date_sales'::regclass,
  'public.idx_system_call_history_acquired_sales_date'::regclass
);
