-- Run after 20260820000001 in Supabase SQL Editor as service_role or manager.

-- 1. 2026-08-19 production reconciliation. All expected_match values must be true.
with payload as (
  select public.system_call_metrics(date '2026-08-19', date '2026-08-19', null, null) as value
), actual as (
  select employee_name, work_seconds, call_count
  from payload, jsonb_to_recordset(value->'employee_metrics') as row(
    employee_name text, work_seconds bigint, call_count bigint
  )
), expected(employee_name, work_seconds, call_count) as (
  values
    ('梶野　恵園', 18856::bigint, 171::bigint),
    ('宮永　ひかり', 24435::bigint, 101::bigint),
    ('宮本　桃華', 22143::bigint, 262::bigint),
    ('小泉　翔', 22468::bigint, 74::bigint),
    ('舩木　稜太', 9904::bigint, 54::bigint),
    ('西野　紗良', 7763::bigint, 79::bigint),
    ('森　健登', 21997::bigint, 200::bigint),
    ('谷本　結那', 21850::bigint, 292::bigint)
)
select expected.employee_name,
  actual.work_seconds, expected.work_seconds as expected_work_seconds,
  actual.call_count, expected.call_count as expected_call_count,
  actual.work_seconds = expected.work_seconds
    and actual.call_count = expected.call_count as expected_match
from expected left join actual using (employee_name)
order by expected.employee_name;

-- 2. 梶野さん's result-flag breakdown.
with payload as (
  select public.system_call_metrics(date '2026-08-19', date '2026-08-19', null, '梶野　恵園') as value
)
select *
from payload, jsonb_to_recordset(value->'employee_metrics') as row(
  employee_name text, call_count bigint, toss_count bigint, acquired_count bigint,
  order_count bigint, prospect_count bigint, absent_count bigint,
  away_count bigint, invalid_count bigint, work_seconds bigint
);
-- Expected: call=171, toss=2, acquired=0, preconfirm=0,
-- prospect=21, absent=52, away=81, invalid=13, work_seconds=18856.

-- 3. Three-month performance. Record Execution Time from both plans.
-- New RPC including indexed daily work spans:
explain (analyze, buffers)
select public.system_call_metrics(date '2026-05-20', date '2026-08-19', null, null);

-- Rollup-only baseline for comparison:
explain (analyze, buffers)
select employee_name,
  sum(call_count)::bigint as call_count,
  coalesce(sum(call_count) filter (where result_flag not in ('留守', '無効', '空')), 0)::bigint as effective_count,
  coalesce(sum(call_count) filter (where result_flag = 'トス'), 0)::bigint as toss_count,
  coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint as acquired_count
from public.system_call_daily_rollup
where call_date between date '2026-05-20' and date '2026-08-19'
group by employee_name;

-- 4. Confirm the existing employee/date index is valid and inspect the work-time plan.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'system_call_history'
  and indexname = 'idx_system_call_history_employee_date';

explain (analyze, buffers)
select call_date,
  min(call_time) as first_start,
  max(coalesce(call_ended_time, call_time)) as last_end
from public.system_call_history
where employee_name = '梶野　恵園'
  and call_date between date '2026-05-20' and date '2026-08-19'
group by call_date;
