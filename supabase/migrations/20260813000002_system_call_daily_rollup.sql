-- Daily call-metrics rollup. system_call_history remains the source of truth.

create table if not exists public.system_call_daily_rollup (
  call_date date not null,
  employee_name text not null,
  list_name text not null,
  result_flag text not null,
  call_count bigint not null check (call_count > 0),
  max_imported_at timestamptz not null,
  primary key (call_date, employee_name, list_name, result_flag)
);

comment on table public.system_call_daily_rollup is
  'Daily call counts normalized and grouped by date, employee, list, and result flag. Rebuildable from system_call_history.';
comment on column public.system_call_daily_rollup.result_flag is
  'Normalized result flag. NULL/empty/whitespace source values use the sentinel 空.';

alter table public.system_call_daily_rollup enable row level security;
-- No anon/authenticated policies. Writes are performed only through the service-role refresh function.

create or replace function public.system_call_rollup_refresh(p_dates date[])
returns table(refreshed_dates integer, rollup_rows bigint, source_rows bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dates date[];
begin
  select coalesce(array_agg(distinct d order by d), '{}'::date[])
    into v_dates
  from unnest(coalesce(p_dates, '{}'::date[])) as supplied(d)
  where d is not null;

  if cardinality(v_dates) = 0 then
    return query select 0, 0::bigint, 0::bigint;
    return;
  end if;

  delete from public.system_call_daily_rollup r
  where r.call_date = any(v_dates);

  insert into public.system_call_daily_rollup (
    call_date, employee_name, list_name, result_flag, call_count, max_imported_at
  )
  select
    h.call_date,
    coalesce(nullif(btrim(h.employee_name), ''), '氏名なし'),
    coalesce(nullif(btrim(h.list_name), ''), 'リスト名なし'),
    coalesce(nullif(btrim(h.result_flag), ''), '空'),
    count(*)::bigint,
    max(h.imported_at)
  from public.system_call_history h
  where h.call_date = any(v_dates)
  group by 1, 2, 3, 4;

  return query
  select cardinality(v_dates),
    count(*)::bigint,
    coalesce(sum(r.call_count), 0)::bigint
  from public.system_call_daily_rollup r
  where r.call_date = any(v_dates);
end;
$$;

revoke all on function public.system_call_rollup_refresh(date[]) from public;
revoke all on function public.system_call_rollup_refresh(date[]) from anon;
revoke all on function public.system_call_rollup_refresh(date[]) from authenticated;
grant execute on function public.system_call_rollup_refresh(date[]) to service_role;

alter table public.system_call_sync_log
  add column if not exists rollup_refresh_status text,
  add column if not exists rollup_refresh_error text;

alter table public.system_call_sync_log
  drop constraint if exists system_call_sync_log_rollup_refresh_status_check;
alter table public.system_call_sync_log
  add constraint system_call_sync_log_rollup_refresh_status_check
  check (rollup_refresh_status is null or rollup_refresh_status in ('success', 'failure', 'skipped'));

comment on column public.system_call_sync_log.rollup_refresh_status is
  'Best-effort daily rollup refresh result; independent of the source-data ingest status.';
comment on column public.system_call_sync_log.rollup_refresh_error is
  'Sanitized rollup refresh failure message; never contains database or secret details.';

-- Initial build for every date currently present in the source table.
truncate table public.system_call_daily_rollup;
select * from public.system_call_rollup_refresh(
  array(select distinct call_date from public.system_call_history where call_date is not null)
);

do $$
declare
  v_source_rows bigint;
  v_rollup_rows bigint;
begin
  select count(*) into v_source_rows from public.system_call_history;
  select coalesce(sum(call_count), 0) into v_rollup_rows from public.system_call_daily_rollup;
  if v_source_rows <> v_rollup_rows then
    raise exception 'Initial call rollup verification failed: source %, rollup %', v_source_rows, v_rollup_rows;
  end if;
end;
$$;

-- Verification after applying migration A:
-- select (select count(*) from public.system_call_history) as source_rows,
--        (select coalesce(sum(call_count), 0) from public.system_call_daily_rollup) as rollup_rows;
-- select call_date, sum(call_count) from public.system_call_daily_rollup
-- group by call_date order by call_date desc limit 10;
-- Idempotency check: run twice and verify identical output/counts.
-- select * from public.system_call_rollup_refresh(array[current_date - 1]);
-- select * from public.system_call_rollup_refresh(array[current_date - 1]);
