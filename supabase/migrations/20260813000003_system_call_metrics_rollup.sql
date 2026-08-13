-- Switch the live four-argument metrics RPC from raw rows to the daily rollup.
-- The dead three-argument overload is intentionally not recreated.

create or replace function public.system_call_metrics(
  p_from date,
  p_to date,
  p_list_name text default null,
  p_employee_name text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select coalesce(auth.role() = 'service_role', false)
      or coalesce(public.garden_role_of(auth.uid()) in ('manager', 'admin', 'super_admin'), false) as allowed
  ),
  base as (
    select r.*
    from public.system_call_daily_rollup r
    cross join authorized a
    where a.allowed
      and r.call_date between p_from and p_to
      and (p_list_name is null or r.list_name = btrim(p_list_name))
      and (p_employee_name is null or r.employee_name = btrim(p_employee_name))
  ),
  list_metrics as (
    select list_name,
      sum(call_count)::bigint as call_count,
      coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::bigint as effective_count,
      round(coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::numeric / nullif(sum(call_count), 0), 6) as effective_rate,
      coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::bigint as order_count,
      coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint as acquired_count,
      round(coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::numeric / nullif(sum(call_count), 0), 6) as call_order_rate
    from base group by list_name order by sum(call_count) desc, list_name
  ),
  employee_metrics as (
    select employee_name,
      sum(call_count)::bigint as call_count,
      coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::bigint as effective_count,
      round(coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::numeric / nullif(sum(call_count), 0), 6) as effective_rate,
      coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::bigint as order_count,
      coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint as acquired_count,
      round(coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::numeric / nullif(sum(call_count), 0), 6) as call_order_rate
    from base group by employee_name order by sum(call_count) desc, employee_name
  )
  select case when not (select allowed from authorized) then jsonb_build_object('error', 'forbidden')
    else jsonb_build_object(
      'authorized', true,
      'metrics', coalesce((select jsonb_agg(to_jsonb(list_metrics)) from list_metrics), '[]'::jsonb),
      'employee_metrics', coalesce((select jsonb_agg(to_jsonb(employee_metrics)) from employee_metrics), '[]'::jsonb),
      'last_imported_at', (select max(max_imported_at) from base)
    ) end;
$$;

revoke all on function public.system_call_metrics(date, date, text, text) from public;
revoke all on function public.system_call_metrics(date, date, text, text) from anon;
grant execute on function public.system_call_metrics(date, date, text, text) to authenticated;
grant execute on function public.system_call_metrics(date, date, text, text) to service_role;

comment on function public.system_call_metrics(date, date, text, text) is
  'Manager or service-role call metrics served from system_call_daily_rollup.';

-- Post-apply timing (run several times; use the same one-year range as the raw baseline):
-- explain (analyze, buffers) select public.system_call_metrics(date '2025-08-13', date '2026-08-12', null, null);
-- Cross-filter plans; add no secondary index unless measurements require it:
-- explain (analyze, buffers) select public.system_call_metrics(date '2025-08-13', date '2026-08-12', '対象リスト', null);
-- explain (analyze, buffers) select public.system_call_metrics(date '2025-08-13', date '2026-08-12', null, '対象社員');

