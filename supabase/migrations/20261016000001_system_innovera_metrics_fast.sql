begin;

-- Original implementation and privileges retained for comparison/rollback.
create or replace function public.system_innovera_metrics_v1(
  p_from date,
  p_to date,
  p_lp_circuit_ids integer[],
  p_employee_id text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select coalesce(auth.role() = 'service_role', false)
      or public.garden_role_of(auth.uid()) in ('staff', 'manager', 'admin', 'super_admin') as allowed
  ),
  bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Tokyo') as from_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Tokyo') as to_ts
  ),
  calls as (
    select c.*, (c.circuit_id = any(coalesce(p_lp_circuit_ids, array[]::integer[]))) as is_lp,
      case when c.call_type = 2 then c.caller_num else c.callee_num end as extension
    from public.system_innovera_call c, bounds b, authorized a
    where a.allowed
      and c.start_time >= b.from_ts
      and c.start_time < b.to_ts
  ),
  assigned as (
    select c.*,
      coalesce(direct.employee_id, daily.employee_id) as employee_id
    from calls c
    left join lateral (
      select e.employee_id
      from public.root_employees e
      where e.is_active = true
        and e.deleted_at is null
        and c.extension in (e.innovera_extension, e.innovera_mobile_extension)
      order by e.employee_id
      limit 1
    ) direct on true
    left join lateral (
      select d.employee_id
      from public.system_innovera_daily_extension d
      where direct.employee_id is null
        and d.extension = c.extension
        and d.started_at <= c.start_time
        and c.start_time < coalesce(d.ended_at, ((d.work_date + 1)::timestamp at time zone 'Asia/Tokyo'))
      order by d.started_at desc
      limit 1
    ) daily on true
  ),
  employee_metrics as (
    select employee_id,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2) and not is_lp), 0)::bigint as talk_seconds_other,
      count(*) filter (where is_lp and call_type = 1 and dial_status = 1)::bigint as lp_answered,
      count(*) filter (where is_lp and call_type = 2)::bigint as lp_outbound,
      coalesce(sum(talk_seconds) filter (where is_lp and call_type in (1,2)), 0)::bigint as lp_talk_seconds
    from assigned
    where employee_id is not null
      and (p_employee_id is null or employee_id = p_employee_id)
    group by employee_id
    order by employee_id
  ),
  unassigned as (
    select extension,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2) and not is_lp), 0)::bigint as talk_seconds_other,
      count(*) filter (where is_lp and call_type = 1 and dial_status = 1)::bigint as lp_answered,
      count(*) filter (where is_lp and call_type = 2)::bigint as lp_outbound,
      coalesce(sum(talk_seconds) filter (where is_lp and call_type in (1,2)), 0)::bigint as lp_talk_seconds
    from assigned
    where employee_id is null and nullif(btrim(coalesce(extension, '')), '') is not null
    group by extension
    order by extension
  ),
  circuit_metrics as (
    select circuit_id,
      count(*) filter (where call_type = 1)::bigint as inbound,
      count(*) filter (where call_type = 1 and dial_status = 1)::bigint as answered,
      count(*) filter (where call_type = 1 and dial_status in (2,3))::bigint as missed,
      count(*) filter (where call_type = 8)::bigint as voicemail,
      count(*) filter (where call_type = 2)::bigint as outbound,
      count(*) filter (where call_type = 2 and dial_status = 1)::bigint as outbound_answered,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2)), 0)::bigint as talk_seconds
    from calls
    where is_lp
    group by circuit_id
    order by circuit_id
  )
  select case when not (select allowed from authorized) then jsonb_build_object('authorized', false)
    else jsonb_build_object(
      'employee_metrics', coalesce((select jsonb_agg(to_jsonb(employee_metrics)) from employee_metrics), '[]'::jsonb),
      'unassigned', coalesce((select jsonb_agg(to_jsonb(unassigned)) from unassigned), '[]'::jsonb),
      'circuit_metrics', coalesce((select jsonb_agg(to_jsonb(circuit_metrics)) from circuit_metrics), '[]'::jsonb),
      'last_sync_at', (select max(finished_at) from public.system_innovera_ingest_log where status = 'success'),
      'has_rows', exists(select 1 from calls),
      'authorized', true
    ) end;
$$;

revoke all on function public.system_innovera_metrics_v1(date, date, integer[], text) from public;
revoke all on function public.system_innovera_metrics_v1(date, date, integer[], text) from anon;
grant execute on function public.system_innovera_metrics_v1(date, date, integer[], text) to authenticated;
grant execute on function public.system_innovera_metrics_v1(date, date, integer[], text) to service_role;

-- Reuse the existing start_time index; eliminate per-call employee lookups
-- before considering another large index based on measured execution plans.
create or replace function public.system_innovera_metrics(
  p_from date,
  p_to date,
  p_lp_circuit_ids integer[],
  p_employee_id text default null
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select coalesce(auth.role() = 'service_role', false)
      or public.garden_role_of(auth.uid()) in ('staff', 'manager', 'admin', 'super_admin') as allowed
  ),
  bounds as (
    select
      (p_from::timestamp at time zone 'Asia/Tokyo') as from_ts,
      ((p_to + 1)::timestamp at time zone 'Asia/Tokyo') as to_ts
  ),
  calls as (
    select c.circuit_id, c.call_type, c.dial_status, c.talk_seconds, c.start_time, (c.circuit_id = any(coalesce(p_lp_circuit_ids, array[]::integer[]))) as is_lp,
      case when c.call_type = 2 then c.caller_num else c.callee_num end as extension
    from public.system_innovera_call c, bounds b, authorized a
    where a.allowed
      and c.start_time >= b.from_ts
      and c.start_time < b.to_ts
  ),
  -- Aggregate before assignment; only time-dependent extensions need raw calls.
  grouped_calls as materialized (
    select extension, circuit_id, call_type, dial_status, is_lp,
      count(*)::bigint as call_count, sum(talk_seconds)::bigint as talk_seconds
    from calls
    group by extension, circuit_id, call_type, dial_status, is_lp
  ),
  extension_assignment as materialized (
    select x.extension, direct.employee_id,
      direct.employee_id is null and exists (
        select 1 from public.system_innovera_daily_extension d
        where d.extension = x.extension
      ) as needs_daily
    from (select distinct extension from grouped_calls) x
    left join lateral (
      select e.employee_id
      from public.root_employees e
      where e.is_active = true
        and e.deleted_at is null
        and x.extension in (e.innovera_extension, e.innovera_mobile_extension)
      order by e.employee_id
      limit 1
    ) direct on true
  ),
  assigned as (
    select g.*, a.employee_id
    from grouped_calls g
    join extension_assignment a on a.extension is not distinct from g.extension
    where not a.needs_daily
    union all
    select c.extension, c.circuit_id, c.call_type, c.dial_status, c.is_lp,
      1::bigint as call_count, c.talk_seconds::bigint, daily.employee_id
    from calls c
    join extension_assignment a on a.extension = c.extension and a.needs_daily
    left join lateral (
      select d.employee_id
      from public.system_innovera_daily_extension d
      where d.extension = c.extension
        and d.started_at <= c.start_time
        and c.start_time < coalesce(d.ended_at, ((d.work_date + 1)::timestamp at time zone 'Asia/Tokyo'))
      order by d.started_at desc
      limit 1
    ) daily on true
  ),
  employee_metrics as (
    select employee_id,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2) and not is_lp), 0)::bigint as talk_seconds_other,
      coalesce(sum(call_count) filter (where is_lp and call_type = 1 and dial_status = 1), 0)::bigint as lp_answered,
      coalesce(sum(call_count) filter (where is_lp and call_type = 2), 0)::bigint as lp_outbound,
      coalesce(sum(talk_seconds) filter (where is_lp and call_type in (1,2)), 0)::bigint as lp_talk_seconds
    from assigned
    where employee_id is not null
      and (p_employee_id is null or employee_id = p_employee_id)
    group by employee_id
    order by employee_id
  ),
  unassigned as (
    select extension,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2) and not is_lp), 0)::bigint as talk_seconds_other,
      coalesce(sum(call_count) filter (where is_lp and call_type = 1 and dial_status = 1), 0)::bigint as lp_answered,
      coalesce(sum(call_count) filter (where is_lp and call_type = 2), 0)::bigint as lp_outbound,
      coalesce(sum(talk_seconds) filter (where is_lp and call_type in (1,2)), 0)::bigint as lp_talk_seconds
    from assigned
    where employee_id is null and nullif(btrim(coalesce(extension, '')), '') is not null
    group by extension
    order by extension
  ),
  circuit_metrics as (
    select circuit_id,
      coalesce(sum(call_count) filter (where call_type = 1), 0)::bigint as inbound,
      coalesce(sum(call_count) filter (where call_type = 1 and dial_status = 1), 0)::bigint as answered,
      coalesce(sum(call_count) filter (where call_type = 1 and dial_status in (2,3)), 0)::bigint as missed,
      coalesce(sum(call_count) filter (where call_type = 8), 0)::bigint as voicemail,
      coalesce(sum(call_count) filter (where call_type = 2), 0)::bigint as outbound,
      coalesce(sum(call_count) filter (where call_type = 2 and dial_status = 1), 0)::bigint as outbound_answered,
      coalesce(sum(talk_seconds) filter (where call_type in (1,2)), 0)::bigint as talk_seconds
    from grouped_calls
    where is_lp
    group by circuit_id
    order by circuit_id
  )
  select case when not (select allowed from authorized) then jsonb_build_object('authorized', false)
    else jsonb_build_object(
      'employee_metrics', coalesce((select jsonb_agg(to_jsonb(employee_metrics)) from employee_metrics), '[]'::jsonb),
      'unassigned', coalesce((select jsonb_agg(to_jsonb(unassigned)) from unassigned), '[]'::jsonb),
      'circuit_metrics', coalesce((select jsonb_agg(to_jsonb(circuit_metrics)) from circuit_metrics), '[]'::jsonb),
      'last_sync_at', (select max(finished_at) from public.system_innovera_ingest_log where status = 'success'),
      'has_rows', exists(select 1 from calls),
      'authorized', true
    ) end;
$$;

revoke all on function public.system_innovera_metrics(date, date, integer[], text) from public;
revoke all on function public.system_innovera_metrics(date, date, integer[], text) from anon;
grant execute on function public.system_innovera_metrics(date, date, integer[], text) to authenticated;
grant execute on function public.system_innovera_metrics(date, date, integer[], text) to service_role;

commit;
