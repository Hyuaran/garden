-- Run after migration A and before/after migration B in Supabase SQL Editor.
-- Change the dates/filters in params to the range being verified.
with params as (
  select date '2025-08-13' as p_from, date '2026-08-12' as p_to,
    null::text as p_list_name, null::text as p_employee_name
),
raw as (
  select h.call_date,
    coalesce(nullif(btrim(h.employee_name), ''), '氏名なし') as employee_name,
    coalesce(nullif(btrim(h.list_name), ''), 'リスト名なし') as list_name,
    coalesce(nullif(btrim(h.result_flag), ''), '空') as result_flag,
    count(*)::bigint as call_count,
    max(h.imported_at) as max_imported_at
  from public.system_call_history h cross join params p
  where h.call_date between p.p_from and p.p_to
    and (p.p_list_name is null or coalesce(nullif(btrim(h.list_name), ''), 'リスト名なし') = btrim(p.p_list_name))
    and (p.p_employee_name is null or coalesce(nullif(btrim(h.employee_name), ''), '氏名なし') = btrim(p.p_employee_name))
  group by 1, 2, 3, 4
),
rolled as (
  select r.* from public.system_call_daily_rollup r cross join params p
  where r.call_date between p.p_from and p.p_to
    and (p.p_list_name is null or r.list_name = btrim(p.p_list_name))
    and (p.p_employee_name is null or r.employee_name = btrim(p.p_employee_name))
),
cell_diff as (
  (select * from raw except select * from rolled)
  union all
  (select * from rolled except select * from raw)
),
raw_summary as (
  select sum(call_count)::bigint calls,
    coalesce(sum(call_count) filter (where result_flag not in ('留守','無効','空')), 0)::bigint effective,
    coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::bigint orders,
    coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint acquired,
    max(max_imported_at) last_imported_at from raw
),
rollup_summary as (
  select sum(call_count)::bigint calls,
    coalesce(sum(call_count) filter (where result_flag not in ('留守','無効','空')), 0)::bigint effective,
    coalesce(sum(call_count) filter (where result_flag = '前確OK'), 0)::bigint orders,
    coalesce(sum(call_count) filter (where result_flag = '獲得'), 0)::bigint acquired,
    max(max_imported_at) last_imported_at from rolled
)
select
  (select count(*) from cell_diff) as differing_cells,
  (select to_jsonb(rs) from raw_summary rs)
    = (select to_jsonb(rus) from rollup_summary rus) as summary_matches,
  (select to_jsonb(rs) from raw_summary rs) as raw_summary,
  (select to_jsonb(rus) from rollup_summary rus) as rollup_summary;

-- Expected: differing_cells = 0 and summary_matches = true.
-- After migration B, measure the live one-year RPC several times:
explain (analyze, buffers)
select public.system_call_metrics(date '2025-08-13', date '2026-08-12', null, null);

