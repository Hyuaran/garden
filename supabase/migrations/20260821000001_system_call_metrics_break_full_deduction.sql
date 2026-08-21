-- Codex-187 + 休憩控除の是正: employee work time and result-flag breakdown for the call metrics portal.
--
-- Production application (Supabase SQL Editor):
--   1. Paste this entire file into SQL Editor and run it once.
--   2. Expected application time is a few seconds because this only replaces the
--      function definition; the function body is not evaluated during deployment.
--   3. This migration does not create an index or rewrite/lock either data table.
--      CREATE OR REPLACE briefly locks the function definition, but does not block
--      writes to system_call_history or system_call_daily_rollup.
--   4. Run scripts/call-metrics-employee-work-verify.sql after application.
-- Do not apply this migration from Codex; production application is manual.
set statement_timeout = '2min';

create or replace function public.system_call_metrics(
  p_from date, p_to date, p_list_name text default null, p_employee_name text default null
) returns jsonb language sql stable security definer set search_path = public as $$
  with authorized as (
    select coalesce(auth.role() = 'service_role', false)
      or coalesce(public.garden_role_of(auth.uid()) in ('manager', 'admin', 'super_admin'), false) as allowed
  ), rollup_base as (
    select r.*
    from public.system_call_daily_rollup r
    cross join authorized a
    where a.allowed
      and r.call_date between p_from and p_to
      and (p_list_name is null or r.list_name = btrim(p_list_name))
      and (p_employee_name is null or r.employee_name = btrim(p_employee_name))
  ), rollup_list_metrics as (
    select list_name,
      sum(call_count)::bigint as call_count,
      coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::bigint as effective_count,
      coalesce(sum(call_count) filter (where result_flag = 'トス'), 0)::bigint as toss_count,
      coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint as acquired_count
    from rollup_base
    group by list_name
  ), rollup_employee_metrics as (
    select employee_name,
      sum(call_count)::bigint as call_count,
      coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::bigint as effective_count,
      coalesce(sum(call_count) filter (where result_flag = 'トス'), 0)::bigint as toss_count,
      coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint as acquired_count,
      coalesce(sum(call_count) filter (where result_flag = '見込'), 0)::bigint as prospect_count,
      coalesce(sum(call_count) filter (where result_flag = '担不'), 0)::bigint as absent_count,
      coalesce(sum(call_count) filter (where result_flag = '留守'), 0)::bigint as away_count,
      coalesce(sum(call_count) filter (where result_flag = '無効'), 0)::bigint as invalid_count
    from rollup_base
    group by employee_name
  ), attributed_preconfirm as (
    select
      coalesce(nullif(btrim(acquired.employee_name), ''), nullif(btrim(preconfirm.employee_name), ''), '氏名なし') as employee_name,
      coalesce(nullif(btrim(acquired.list_name), ''), nullif(btrim(preconfirm.list_name), ''), 'リスト名なし') as list_name
    from public.system_call_history preconfirm
    cross join authorized authz
    left join lateral (
      select candidate.employee_name, candidate.list_name
      from public.system_call_history candidate
      where preconfirm.external_sales_id is not null
        and btrim(preconfirm.external_sales_id) <> ''
        and candidate.external_sales_id = preconfirm.external_sales_id
        and candidate.result_flag = '獲得'
      order by
        (candidate.call_date <= preconfirm.call_date) desc,
        case when candidate.call_date <= preconfirm.call_date then candidate.call_date end desc,
        case when candidate.call_date <= preconfirm.call_date then candidate.call_time end desc nulls last,
        case when candidate.call_date > preconfirm.call_date then candidate.call_date end desc,
        case when candidate.call_date > preconfirm.call_date then candidate.call_time end desc nulls last,
        candidate.id desc
      limit 1
    ) acquired on true
    where authz.allowed
      and preconfirm.result_flag = '前確OK'
      and preconfirm.call_date between p_from and p_to
  ), filtered_preconfirm as (
    select employee_name, list_name
    from attributed_preconfirm
    where (p_list_name is null or list_name = btrim(p_list_name))
      and (p_employee_name is null or employee_name = btrim(p_employee_name))
  ), preconfirm_by_list as (
    select list_name, count(*)::bigint as order_count
    from filtered_preconfirm
    group by list_name
  ), preconfirm_by_employee as (
    select employee_name, count(*)::bigint as order_count
    from filtered_preconfirm
    group by employee_name
  ), list_metrics as (
    select coalesce(rollup.list_name, preconfirm.list_name) as list_name,
      coalesce(rollup.call_count, 0)::bigint as call_count,
      coalesce(rollup.effective_count, 0)::bigint as effective_count,
      coalesce(round(rollup.effective_count::numeric / nullif(rollup.call_count, 0), 6), 0::numeric) as effective_rate,
      coalesce(rollup.toss_count, 0)::bigint as toss_count,
      coalesce(preconfirm.order_count, 0)::bigint as order_count,
      coalesce(rollup.acquired_count, 0)::bigint as acquired_count,
      coalesce(round(preconfirm.order_count::numeric / nullif(rollup.call_count, 0), 6), 0::numeric) as call_order_rate,
      coalesce(round(rollup.acquired_count::numeric / nullif(rollup.call_count, 0), 6), 0::numeric) as call_acquired_rate
    from rollup_list_metrics rollup
    full outer join preconfirm_by_list preconfirm using (list_name)
    order by coalesce(rollup.call_count, 0) desc, coalesce(rollup.list_name, preconfirm.list_name)
  ), employee_base as (
    select coalesce(rollup.employee_name, preconfirm.employee_name) as employee_name,
      coalesce(rollup.call_count, 0)::bigint as call_count,
      coalesce(rollup.effective_count, 0)::bigint as effective_count,
      coalesce(rollup.toss_count, 0)::bigint as toss_count,
      coalesce(preconfirm.order_count, 0)::bigint as order_count,
      coalesce(rollup.acquired_count, 0)::bigint as acquired_count,
      coalesce(rollup.prospect_count, 0)::bigint as prospect_count,
      coalesce(rollup.absent_count, 0)::bigint as absent_count,
      coalesce(rollup.away_count, 0)::bigint as away_count,
      coalesce(rollup.invalid_count, 0)::bigint as invalid_count
    from rollup_employee_metrics rollup
    full outer join preconfirm_by_employee preconfirm using (employee_name)
  ), breaks(b_start, b_end) as (
    values
      (time '11:15', time '11:30'),
      (time '13:00', time '14:00'),
      (time '15:20', time '15:30'),
      (time '16:45', time '17:00'),
      (time '18:20', time '18:30'),
      (time '19:50', time '20:00')
  ), employee_daily_span as (
    select employee.employee_name, span.call_date, span.first_start, span.last_end
    from employee_base employee
    cross join lateral (
      select history.call_date,
        min(history.call_time) as first_start,
        max(coalesce(history.call_ended_time, history.call_time)) as last_end
      from public.system_call_history history
      where history.call_date between p_from and p_to
        and history.call_time is not null
        and (
          history.employee_name = employee.employee_name
          or (employee.employee_name = '氏名なし' and nullif(btrim(history.employee_name), '') is null)
        )
        and (p_list_name is null or history.list_name = btrim(p_list_name))
      group by history.call_date
    ) span
  ), employee_daily_work as (
    select daily.employee_name, daily.call_date,
      greatest(0::numeric,
        extract(epoch from (daily.last_end - daily.first_start))
        -- 休憩は「その時間帯をまたいで働いていた場合だけ、全額」引く。
        -- 休憩中に架電していても、本人は別の時間に同じ長さの休憩を取っているため全額引く。
        -- 逆に休憩枠の途中から働き始めた／途中で終業した場合は、その休憩は取っていないので引かない。
        - coalesce((
          select sum(extract(epoch from (break_time.b_end - break_time.b_start)))
          from breaks break_time
          where daily.first_start <= break_time.b_start
            and break_time.b_end <= daily.last_end
        ), 0::numeric)
      ) as work_seconds
    from employee_daily_span daily
    where daily.first_start is not null and daily.last_end is not null
  ), employee_work as (
    select employee_name, coalesce(sum(work_seconds), 0)::bigint as work_seconds
    from employee_daily_work
    group by employee_name
  ), employee_metrics as (
    select employee.employee_name,
      employee.call_count,
      employee.effective_count,
      coalesce(round(employee.effective_count::numeric / nullif(employee.call_count, 0), 6), 0::numeric) as effective_rate,
      employee.toss_count,
      employee.order_count,
      employee.acquired_count,
      coalesce(round(employee.order_count::numeric / nullif(employee.call_count, 0), 6), 0::numeric) as call_order_rate,
      coalesce(round(employee.acquired_count::numeric / nullif(employee.call_count, 0), 6), 0::numeric) as call_acquired_rate,
      employee.prospect_count,
      employee.absent_count,
      employee.away_count,
      employee.invalid_count,
      coalesce(work.work_seconds, 0)::bigint as work_seconds
    from employee_base employee
    left join employee_work work using (employee_name)
    order by employee.call_count desc, employee.employee_name
  )
  select case
    when not (select allowed from authorized) then jsonb_build_object('error', 'forbidden')
    else jsonb_build_object(
      'authorized', true,
      'metrics', coalesce((select jsonb_agg(to_jsonb(list_metrics)) from list_metrics), '[]'::jsonb),
      'employee_metrics', coalesce((select jsonb_agg(to_jsonb(employee_metrics)) from employee_metrics), '[]'::jsonb),
      'last_imported_at', (select max(max_imported_at) from rollup_base)
    )
  end;
$$;

revoke all on function public.system_call_metrics(date, date, text, text) from public;
revoke all on function public.system_call_metrics(date, date, text, text) from anon;
grant execute on function public.system_call_metrics(date, date, text, text) to authenticated;
grant execute on function public.system_call_metrics(date, date, text, text) to service_role;
comment on function public.system_call_metrics(date, date, text, text) is
  'Manager or service-role rollup metrics; employee work time reads indexed call history daily spans and 前確OK remains reattributed by external_sales_id.';
