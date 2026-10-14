begin;

create or replace function public.system_innovera_norm_number(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') = '' then null
    when regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') like '81%'
      and length(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')) >= 11
      then '0' || substring(regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') from 3)
    else regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g')
  end;
$$;

create table if not exists public.system_innovera_call (
  innovera_id text primary key,
  uniqid text,
  linkedid text,
  circuit_id integer not null default 0,
  circuit_name text,
  circuit_num text,
  caller_num text,
  callee_num text,
  call_type smallint,
  dial_status smallint,
  talk_seconds integer not null default 0,
  start_time timestamptz not null,
  answer_time timestamptz,
  end_time timestamptz,
  who_hangup text,
  record_file_flg text,
  raw jsonb,
  imported_at timestamptz not null default now(),
  caller_num_norm text generated always as (public.system_innovera_norm_number(caller_num)) stored,
  callee_num_norm text generated always as (public.system_innovera_norm_number(callee_num)) stored
);

create index if not exists idx_system_innovera_call_start_time
  on public.system_innovera_call(start_time);
create index if not exists idx_system_innovera_call_circuit_start
  on public.system_innovera_call(circuit_id, start_time);
create index if not exists idx_system_innovera_call_callee_start
  on public.system_innovera_call(callee_num, start_time);
create index if not exists idx_system_innovera_call_caller_start
  on public.system_innovera_call(caller_num, start_time);
create index if not exists idx_system_innovera_call_callee_norm_start
  on public.system_innovera_call(callee_num_norm, start_time);
create index if not exists idx_system_innovera_call_caller_norm_start
  on public.system_innovera_call(caller_num_norm, start_time);

alter table public.system_innovera_call enable row level security;

comment on table public.system_innovera_call is
  'INNOVERA の CDR をそのまま参照できる粒度で保持する通話履歴。RLS は有効、通常アクセスは service_role/RPC 経由。';
comment on column public.system_innovera_call.raw is
  'INNOVERA API から受け取った 1 行分の原文 JSON。';

create table if not exists public.system_innovera_ingest_log (
  id uuid primary key default gen_random_uuid(),
  run_id text,
  mode text check (mode in ('poll','daily','backfill')),
  range_from timestamptz,
  range_to timestamptz,
  fetched integer,
  sent integer,
  upserted integer,
  skipped integer,
  status text check (status in ('success','failed')),
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_system_innovera_ingest_log_status_finished
  on public.system_innovera_ingest_log(status, finished_at desc);

alter table public.system_innovera_ingest_log enable row level security;

comment on table public.system_innovera_ingest_log is
  'INNOVERA CDR 取り込みジョブの実行ログ。既存の番号同期ログとは用途を分ける。';

alter table public.root_employees
  add column if not exists filemaker_employee_name text;

alter table public.root_employees
  drop constraint if exists root_employees_filemaker_employee_name_not_blank;

alter table public.root_employees
  add constraint root_employees_filemaker_employee_name_not_blank
  check (filemaker_employee_name is null or length(btrim(filemaker_employee_name)) > 0);

create unique index if not exists uq_root_employees_filemaker_employee_name
  on public.root_employees(filemaker_employee_name)
  where filemaker_employee_name is not null;

comment on column public.root_employees.filemaker_employee_name is
  'FileMaker コール履歴の社員名と同じ文字列。テレマ集計で FileMaker / INNOVERA / kintone を 1 行に合わせるキー。';

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

revoke all on function public.system_innovera_metrics(date, date, integer[], text) from public;
revoke all on function public.system_innovera_metrics(date, date, integer[], text) from anon;
grant execute on function public.system_innovera_metrics(date, date, integer[], text) to authenticated;
grant execute on function public.system_innovera_metrics(date, date, integer[], text) to service_role;

create or replace function public.system_innovera_funnel_calls(
  p_from date,
  p_to date,
  p_as_of timestamptz,
  p_lp_circuit_ids integer[],
  p_numbers text[]
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
      ((p_to + 1)::timestamp at time zone 'Asia/Tokyo') as to_ts,
      least(p_as_of, ((p_to + 1)::timestamp at time zone 'Asia/Tokyo')) as as_of_ts
  ),
  numbers as (
    select array_remove(array_agg(public.system_innovera_norm_number(value)), null) as vals
    from unnest(coalesce(p_numbers, array[]::text[])) value
  ),
  inbound as (
    select c.circuit_id, c.caller_num_norm, c.start_time, c.dial_status, c.callee_num
    from public.system_innovera_call c, bounds b, authorized a
    where a.allowed
      and c.call_type = 1
      and c.circuit_id = any(coalesce(p_lp_circuit_ids, array[]::integer[]))
      and c.start_time >= b.from_ts
      and c.start_time < b.to_ts
    order by c.start_time
  ),
  outbound as (
    select c.callee_num_norm, c.start_time, c.dial_status, c.caller_num, c.circuit_id
    from public.system_innovera_call c, bounds b, numbers n, authorized a
    where a.allowed
      and c.call_type = 2
      and c.start_time >= b.from_ts
      and c.start_time <= b.as_of_ts
      and c.caller_num ~ '^[0-9]{3,6}$'
      and c.callee_num_norm = any(coalesce(n.vals, array[]::text[]))
    order by c.start_time
  )
  select case when not (select allowed from authorized) then jsonb_build_object('authorized', false)
    else jsonb_build_object(
      'inbound', coalesce((select jsonb_agg(to_jsonb(inbound)) from inbound), '[]'::jsonb),
      'outbound', coalesce((select jsonb_agg(to_jsonb(outbound)) from outbound), '[]'::jsonb),
      'authorized', true
    ) end;
$$;

revoke all on function public.system_innovera_funnel_calls(date, date, timestamptz, integer[], text[]) from public;
revoke all on function public.system_innovera_funnel_calls(date, date, timestamptz, integer[], text[]) from anon;
grant execute on function public.system_innovera_funnel_calls(date, date, timestamptz, integer[], text[]) to authenticated;
grant execute on function public.system_innovera_funnel_calls(date, date, timestamptz, integer[], text[]) to service_role;

commit;

-- 適用後の確認例:
-- select to_regclass('public.system_innovera_call') as system_innovera_call;
-- select to_regclass('public.system_innovera_ingest_log') as system_innovera_ingest_log;
-- select public.system_innovera_norm_number('+81-90-1234-5678') as normalized_number;
-- select public.system_innovera_metrics(current_date - 1, current_date, array[]::integer[], null);
-- select public.system_innovera_funnel_calls(current_date - 1, current_date, now(), array[]::integer[], array[]::text[]);
