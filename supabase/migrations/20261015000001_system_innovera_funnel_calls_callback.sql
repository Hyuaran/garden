-- WEBインバウンドの対応と結果（§5.6）：発信（outbound）の絞り込みに「期間内の LP 回線の着信の発信元番号」を含める。
-- 2026-10-14 の初版は p_numbers（フォームの番号）だけで絞っていたため、折り返し（出られなかった番号へのかけ直し）が 1 件も拾えなかった
-- （2026-10-13 の検算＝ヒカリのプロ・電気開始受付センターとも「折り返して繋がった 2」が「折り返していない 2」になっていた）。
begin;

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
  -- 宛先の候補＝期間内の LP 回線の着信の発信元番号 ＋ フォームの番号（p_numbers・正規化）
  numbers as (
    select array_remove(array_agg(distinct v), null) as vals
    from (
      select caller_num_norm as v from inbound
      union all
      select public.system_innovera_norm_number(value) as v from unnest(coalesce(p_numbers, array[]::text[])) value
    ) s
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

commit;
