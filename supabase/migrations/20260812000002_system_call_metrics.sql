-- Read-only call-center metrics. The RPC enforces the same manager+ gate as the API.
create or replace function public.system_call_metrics(
  p_from date,
  p_to date,
  p_list_name text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select public.garden_role_of(auth.uid()) in ('manager', 'admin', 'super_admin') as allowed
  ),
  base as (
    select
      case when nullif(btrim(h.list_name), '') is null then 'リスト名なし' else btrim(h.list_name) end as normalized_list_name,
      nullif(btrim(h.result_flag), '') as normalized_result_flag
    from public.system_call_history h
    cross join authorized a
    where a.allowed
      and h.call_date between p_from and p_to
  ),
  metrics as (
    select
      normalized_list_name as list_name,
      count(*)::bigint as call_count,
      count(*) filter (where normalized_result_flag not in ('留守', '無効') and normalized_result_flag is not null)::bigint as effective_count,
      round((count(*) filter (where normalized_result_flag not in ('留守', '無効') and normalized_result_flag is not null))::numeric / nullif(count(*), 0), 6) as effective_rate,
      count(*) filter (where normalized_result_flag = '前確OK')::bigint as order_count,
      count(*) filter (where normalized_result_flag = '獲得')::bigint as acquired_count,
      round((count(*) filter (where normalized_result_flag = '前確OK'))::numeric / nullif(count(*), 0), 6) as call_order_rate
    from base
    group by normalized_list_name
    order by count(*) desc, normalized_list_name
  ),
  flag_distribution as (
    select
      coalesce(normalized_result_flag, '空') as result_flag,
      count(*)::bigint as count,
      (normalized_result_flag not in ('留守', '無効') and normalized_result_flag is not null) as is_effective,
      (normalized_result_flag is null or normalized_result_flag in ('留守', '担不', '見込', '無効', '獲得', 'トス', 'NG', '前確OK', '前確NG')) as is_expected
    from base
    where p_list_name is null or normalized_list_name = p_list_name
    group by normalized_result_flag
    order by count(*) desc, normalized_result_flag nulls last
  )
  select case
    when not (select allowed from authorized) then
      jsonb_build_object('error', 'forbidden')
    else jsonb_build_object(
      'metrics', coalesce((select jsonb_agg(to_jsonb(metrics)) from metrics), '[]'::jsonb),
      'result_flags', coalesce((select jsonb_agg(to_jsonb(flag_distribution)) from flag_distribution), '[]'::jsonb)
    )
  end;
$$;

revoke all on function public.system_call_metrics(date, date, text) from public;
revoke all on function public.system_call_metrics(date, date, text) from anon;
grant execute on function public.system_call_metrics(date, date, text) to authenticated;

comment on function public.system_call_metrics(date, date, text) is
  'Manager-only list metrics and result_flag diagnostics calculated from raw system_call_history rows.';

-- Apply once in Supabase SQL Editor, then verify as an authenticated manager:
-- select public.system_call_metrics(current_date - 29, current_date, null);
