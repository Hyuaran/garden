-- 分析①の「購入先を 2 つ以上（かつ）」を速くする（2026-09-28）。
-- 変えたのは台帳の読み方だけ（left join で全件を読む → 選んだ番号だけ引く）。引数・返り値・数え方は 20260917000006 と同じ。
-- 本番で今の関数と 4 条件（2 社・2 社×元回線軸・2 社＋元回線・3 社）の結果が完全一致することを確認済み。

create or replace function public.soil_list_analysis_filtered(
  p_vendors text[] default array[]::text[],
  p_line_types text[] default array[]::text[],
  p_contract_years text[] default array[]::text[],
  p_axis text default 'vendor'
)
returns table (
  block text,
  segment text,
  result text,
  list_name text,
  list_loaded_on date,
  row_count integer,
  called_count integer,
  call_total integer,
  invalid_count integer,
  order_count integer,
  order_case_count integer,
  acquired_count integer,
  last_called_on date,
  segment_last_called_on date
)
language sql
security definer
set search_path = public
as $$
  with selected_vendors as (
    select distinct nullif(btrim(vendor), '') as vendor
    from unnest(coalesce(p_vendors, array[]::text[])) as vendor
    where nullif(btrim(vendor), '') is not null
  ),
  selected_line_types as (
    select distinct btrim(value) as value
    from unnest(coalesce(p_line_types, array[]::text[])) as value
  ),
  selected_contract_years as (
    select distinct btrim(value) as value
    from unnest(coalesce(p_contract_years, array[]::text[])) as value
  ),
  selected_phones as (
    select sp."電話番号"
    from public.soil_list_purchase sp
    join selected_vendors v
      on v.vendor = coalesce(nullif(sp."購入先_NEW", ''), sp."購入先")
    where sp."電話番号" is not null and sp."電話番号" <> ''
    group by sp."電話番号"
    having count(distinct coalesce(nullif(sp."購入先_NEW", ''), sp."購入先")) = (select count(*) from selected_vendors)
  ),
  facts as (
    select
      public.soil_list_analysis_axis_segment(p_axis, p."最新購入先", p."元回線", p."契約時期") as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      coalesce(p."受注案件数", 0) as order_case_count,
      p."最終コール日_集約" as last_called_on
    -- 購入先を選んだときは、選んだ購入先すべてで買った番号だけを台帳から引く（台帳 258 万行を毎回読むと 7〜8 秒・2026-09-27 実測 → 0.2〜0.9 秒）。
    -- 購入先を選ばないときは 1 つ目の枝で全件（one-time filter で 2 つ目の枝は 0 行）
    from (
      select p0.* from public.soil_list_phone p0
      where (select count(*) from selected_vendors) = 0
      union all
      select p1.* from selected_phones t join public.soil_list_phone p1 on p1."電話番号" = t."電話番号"
    ) p
    where p_axis in ('vendor', 'line_type', 'contract_year')
      and p."電話番号" is not null and p."電話番号" <> ''
      and (
        (select count(*) from selected_line_types) = 0
        or coalesce(nullif(p."元回線", ''), '') in (select value from selected_line_types)
      )
      and (
        (select count(*) from selected_contract_years) = 0
        or coalesce(to_char(p."契約時期", 'YYYY'), '（契約時期なし）') in (select value from selected_contract_years)
      )
  )
  select
    p_axis as block,
    f.segment,
    f.result,
    f.list_name,
    max(f.list_loaded_on) as list_loaded_on,
    count(*)::integer as row_count,
    count(*) filter (where f.call_total > 0)::integer as called_count,
    sum(f.call_total)::integer as call_total,
    count(*) filter (where f.result = '無効')::integer as invalid_count,
    count(*) filter (where f.order_count > 0)::integer as order_count,
    sum(f.order_case_count)::integer as order_case_count,
    count(*) filter (where f.result = '獲得')::integer as acquired_count,
    max(f.last_called_on) as last_called_on,
    null::date as segment_last_called_on
  from facts f
  group by f.segment, f.result, f.list_name;
$$;

revoke all on function public.soil_list_analysis_filtered(text[], text[], text[], text) from public, anon, authenticated;
grant execute on function public.soil_list_analysis_filtered(text[], text[], text[], text) to service_role;
