-- Permit the CRON_SECRET-protected service-role route to read call metrics.
-- Metric definitions and manager+ behavior remain unchanged.

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
      or public.garden_role_of(auth.uid()) in ('manager', 'admin', 'super_admin') as allowed
  ),
  normalized as (
    select
      case when nullif(btrim(h.list_name), '') is null then 'リスト名なし' else btrim(h.list_name) end as list_name,
      case when nullif(btrim(h.employee_name), '') is null then '氏名なし' else btrim(h.employee_name) end as employee_name,
      nullif(btrim(h.result_flag), '') as result_flag,
      h.imported_at
    from public.system_call_history h
    cross join authorized a
    where a.allowed and h.call_date between p_from and p_to
  ),
  base as (
    select * from normalized
    where (p_list_name is null or list_name = btrim(p_list_name))
      and (p_employee_name is null or employee_name = btrim(p_employee_name))
  ),
  list_metrics as (
    select list_name, count(*)::bigint as call_count,
      count(*) filter (where result_flag not in ('留守', '無効') and result_flag is not null)::bigint as effective_count,
      round((count(*) filter (where result_flag not in ('留守', '無効') and result_flag is not null))::numeric / nullif(count(*), 0), 6) as effective_rate,
      count(*) filter (where result_flag = '前確OK')::bigint as order_count,
      count(*) filter (where result_flag = '獲得')::bigint as acquired_count,
      round((count(*) filter (where result_flag = '前確OK'))::numeric / nullif(count(*), 0), 6) as call_order_rate
    from base group by list_name order by count(*) desc, list_name
  ),
  employee_metrics as (
    select employee_name, count(*)::bigint as call_count,
      count(*) filter (where result_flag not in ('留守', '無効') and result_flag is not null)::bigint as effective_count,
      round((count(*) filter (where result_flag not in ('留守', '無効') and result_flag is not null))::numeric / nullif(count(*), 0), 6) as effective_rate,
      count(*) filter (where result_flag = '前確OK')::bigint as order_count,
      count(*) filter (where result_flag = '獲得')::bigint as acquired_count,
      round((count(*) filter (where result_flag = '前確OK'))::numeric / nullif(count(*), 0), 6) as call_order_rate
    from base group by employee_name order by count(*) desc, employee_name
  )
  select case when not (select allowed from authorized) then jsonb_build_object('error', 'forbidden')
    else jsonb_build_object(
      'authorized', true,
      'metrics', coalesce((select jsonb_agg(to_jsonb(list_metrics)) from list_metrics), '[]'::jsonb),
      'employee_metrics', coalesce((select jsonb_agg(to_jsonb(employee_metrics)) from employee_metrics), '[]'::jsonb),
      'last_imported_at', (select max(imported_at) from base)
    ) end;
$$;

revoke all on function public.system_call_metrics(date, date, text, text) from public;
revoke all on function public.system_call_metrics(date, date, text, text) from anon;
grant execute on function public.system_call_metrics(date, date, text, text) to authenticated;
grant execute on function public.system_call_metrics(date, date, text, text) to service_role;

comment on function public.system_call_metrics(date, date, text, text) is
  'Manager or service-role call metrics with exact-match cross-filters and latest imported_at.';

-- After applying, verify with the service-role REST/RPC client used by the cron route.
-- The metrics array should contain today's actual call_count rather than {"error":"forbidden"}.
