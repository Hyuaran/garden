-- リストマスタ分析①：切り口（購入先／元回線／契約時期年）と受注案件数を追加する。
-- migration は書くだけ。実行は Claude が DB 直結で行う。
begin;

alter table public.soil_list_analysis_cell
  add column if not exists order_case_count integer not null default 0;

alter table public.soil_list_analysis_cell_next
  add column if not exists order_case_count integer not null default 0;

alter table public.soil_list_phone
  add column if not exists "受注案件数" integer not null default 0;

alter table public.soil_list_analysis_cell
  drop constraint if exists soil_list_analysis_cell_block_check;
alter table public.soil_list_analysis_cell_next
  drop constraint if exists soil_list_analysis_cell_next_block_check;
-- _next は「like … including all」で作ったので、check 制約の名前も本体と同じ soil_list_analysis_cell_block_check を引き継いでいる（2026-09-15 Claude・本番で insert が古い制約に当たった）
alter table public.soil_list_analysis_cell_next
  drop constraint if exists soil_list_analysis_cell_block_check;

alter table public.soil_list_analysis_cell
  add constraint soil_list_analysis_cell_block_check
  check (block in ('vendor', 'line_type', 'contract_year', 'active_list', 'contract'));

alter table public.soil_list_analysis_cell_next
  add constraint soil_list_analysis_cell_next_block_check
  check (block in ('vendor', 'line_type', 'contract_year', 'active_list', 'contract'));

create index if not exists soil_list_purchase_vendor_effective_phone_idx
  on public.soil_list_purchase ((coalesce(nullif("購入先_NEW", ''), "購入先")), "電話番号");

create index if not exists soil_list_purchase_phone_vendor_effective_idx
  on public.soil_list_purchase ("電話番号", (coalesce(nullif("購入先_NEW", ''), "購入先")));

create or replace function public.soil_list_analysis_axis_segment(
  p_axis text,
  p_latest_vendor text,
  p_line_type text,
  p_contract_month date
)
returns text
language sql
immutable
as $$
  select case p_axis
    when 'vendor' then coalesce(nullif(p_latest_vendor, ''), '（購入先なし）')
    when 'line_type' then coalesce(nullif(p_line_type, ''), '（元回線なし）')
    when 'contract_year' then coalesce(to_char(p_contract_month, 'YYYY'), '（契約時期なし）')
    else null
  end;
$$;

create or replace function public.soil_list_refresh_phone_latest(p_phones text[])
returns table (updated integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer := 0;
begin
  create temp table soil_list_latest_target on commit drop as
    select distinct nullif(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), '') as "電話番号"
    from unnest(coalesce(p_phones, array[]::text[])) as phone;

  delete from soil_list_latest_target where "電話番号" is null;

  create unique index on soil_list_latest_target ("電話番号");

  update public.soil_list_phone p
  set
    "最新購入先" = purchase_latest.vendor,
    "最新購入日" = purchase_latest.purchased_on,
    "最終コール結果" = call_latest.last_result,
    "最新受注日" = order_summary.latest_order_on,
    "最新受注商材" = order_summary.latest_product,
    "受注件数" = coalesce(order_summary.order_count, 0),
    "受注案件数" = coalesce(order_summary.order_case_count, 0),
    "購入履歴あり" = coalesce(purchase_latest.has_purchase, false)
  from soil_list_latest_target t
  left join lateral (
    select
      coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor,
      sp."購入日" as purchased_on,
      true as has_purchase
    from public.soil_list_purchase sp
    where sp."電話番号" = t."電話番号"
    order by sp."購入日" desc nulls last, sp.ctid desc
    limit 1
  ) purchase_latest on true
  left join lateral (
    select c."最終結果" as last_result
    from public.soil_list_call c
    where c."電話番号" = t."電話番号"
    order by c."最終コール日" desc nulls last, c.ctid desc
    limit 1
  ) call_latest on true
  left join lateral (
    select
      count(*)::integer as order_count,
      count(distinct o."顧客一覧レコード番号")::integer as order_case_count,
      max(o."受注日") as latest_order_on,
      (array_agg(coalesce(nullif(o."商材名区分2", ''), nullif(o."商材名区分1", '')) order by o."受注日" desc nulls last, o."取込日時" desc, o."顧客一覧レコード番号" desc))[1] as latest_product
    from public.soil_list_order o
    where o."電話番号" = t."電話番号"
  ) order_summary on true
  where p."電話番号" = t."電話番号";

  get diagnostics v_updated = row_count;
  return query select v_updated;
end;
$$;

create or replace function public.soil_list_analysis_begin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.soil_list_analysis_cell_next;

  truncate table public.soil_list_analysis_active_list;
  insert into public.soil_list_analysis_active_list (list_name, segment_last_called_on)
  select p."リスト名", max(p."最終コール日_集約")
  from public.soil_list_phone p
  where p."最終コール日_集約" >= current_date - interval '30 days'
    and coalesce(p."リスト名", '') <> ''
  group by p."リスト名"
  having max(p."リスト投入日") >= current_date - interval '60 days';

  truncate table public.soil_list_analysis_contract_phone;
  insert into public.soil_list_analysis_contract_phone ("電話番号", "既契約情報")
  select phone, contract
  from (
    select
      regexp_replace(translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') as phone,
      coalesce(s."既契約情報", '') as contract,
      row_number() over (
        partition by regexp_replace(translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g')
        order by nullif(s."修正日", '') desc nulls last,
          case when s."主キー" ~ '^[0-9]+$' then s."主キー"::numeric else null end desc nulls last
      ) as rn
    from public.system_fm_shineigyo s
    where regexp_replace(translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'), '[^0-9]', '', 'g') <> ''
  ) ranked
  where rn = 1;

  update public.soil_list_analysis_state
  set last_error = null,
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.soil_list_analysis_collect(p_chunk integer, p_chunks integer default 100)
returns table (rows integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
  v_pages bigint;
  v_lo bigint;
  v_hi bigint;
  v_lo_tid tid;
  v_hi_tid tid;
begin
  if p_chunks is null or p_chunks < 1 or p_chunk is null or p_chunk < 0 or p_chunk >= p_chunks then
    raise exception 'p_chunk must be between 0 and p_chunks - 1';
  end if;

  select pg_relation_size('public.soil_list_phone') / current_setting('block_size')::bigint + 1 into v_pages;
  v_lo := (v_pages * p_chunk) / p_chunks;
  v_hi := (v_pages * (p_chunk + 1)) / p_chunks;
  v_lo_tid := ('(' || v_lo || ',0)')::tid;
  v_hi_tid := case when p_chunk = p_chunks - 1 then null else ('(' || v_hi || ',0)')::tid end;

  insert into public.soil_list_analysis_cell_next (
    block, segment, result, list_name, list_loaded_on,
    row_count, called_count, call_total, invalid_count, order_count, order_case_count, acquired_count,
    last_called_on, segment_last_called_on
  )
  select
    x.block,
    x.segment,
    x.result,
    x.list_name,
    max(x.list_loaded_on) as list_loaded_on,
    count(*)::integer as row_count,
    count(*) filter (where x.call_total > 0)::integer as called_count,
    sum(x.call_total)::integer as call_total,
    count(*) filter (where x.result = '無効')::integer as invalid_count,
    count(*) filter (where x.order_count > 0)::integer as order_count,
    sum(x.order_case_count)::integer as order_case_count,
    count(*) filter (where x.result = '獲得')::integer as acquired_count,
    max(x.last_called_on) as last_called_on,
    max(x.segment_last_called_on) as segment_last_called_on
  from (
    select
      axis.block,
      public.soil_list_analysis_axis_segment(axis.block, p."最新購入先", p."元回線", p."契約時期") as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      coalesce(p."受注案件数", 0) as order_case_count,
      p."最終コール日_集約" as last_called_on,
      null::date as segment_last_called_on
    from public.soil_list_phone p
    cross join (values ('vendor'::text), ('line_type'::text), ('contract_year'::text)) as axis(block)
    where p.ctid >= v_lo_tid and (v_hi_tid is null or p.ctid < v_hi_tid)
      and p."電話番号" is not null and p."電話番号" <> ''

    union all

    select
      'active_list'::text as block,
      s.list_name as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      coalesce(p."受注案件数", 0) as order_case_count,
      p."最終コール日_集約" as last_called_on,
      s.segment_last_called_on
    from public.soil_list_phone p
    join public.soil_list_analysis_active_list s
      on s.list_name = coalesce(nullif(p."リスト名", ''), '（リスト名なし）')
    where p.ctid >= v_lo_tid and (v_hi_tid is null or p.ctid < v_hi_tid)
      and p."電話番号" is not null and p."電話番号" <> ''

    union all

    select
      'contract'::text as block,
      coalesce(nullif(c."既契約情報", ''), '（既契約情報なし）') as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      coalesce(p."受注案件数", 0) as order_case_count,
      p."最終コール日_集約" as last_called_on,
      null::date as segment_last_called_on
    from public.soil_list_phone p
    join public.soil_list_analysis_contract_phone c
      on c."電話番号" = p."電話番号"
    where p.ctid >= v_lo_tid and (v_hi_tid is null or p.ctid < v_hi_tid)
      and p."電話番号" is not null and p."電話番号" <> ''
  ) x
  group by x.block, x.segment, x.result, x.list_name
  on conflict (block, segment, result, list_name) do update set
    list_loaded_on = greatest(public.soil_list_analysis_cell_next.list_loaded_on, excluded.list_loaded_on),
    row_count = public.soil_list_analysis_cell_next.row_count + excluded.row_count,
    called_count = public.soil_list_analysis_cell_next.called_count + excluded.called_count,
    call_total = public.soil_list_analysis_cell_next.call_total + excluded.call_total,
    invalid_count = public.soil_list_analysis_cell_next.invalid_count + excluded.invalid_count,
    order_count = public.soil_list_analysis_cell_next.order_count + excluded.order_count,
    order_case_count = public.soil_list_analysis_cell_next.order_case_count + excluded.order_case_count,
    acquired_count = public.soil_list_analysis_cell_next.acquired_count + excluded.acquired_count,
    last_called_on = greatest(public.soil_list_analysis_cell_next.last_called_on, excluded.last_called_on),
    segment_last_called_on = greatest(public.soil_list_analysis_cell_next.segment_last_called_on, excluded.segment_last_called_on);

  get diagnostics v_rows = row_count;
  return query select v_rows;
end;
$$;

create or replace function public.soil_list_analysis_vendor_and(p_vendors text[], p_axis text)
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
  with normalized_vendors as (
    select distinct nullif(btrim(vendor), '') as vendor
    from unnest(coalesce(p_vendors, array[]::text[])) as vendor
  ),
  selected_vendors as (
    select vendor from normalized_vendors where vendor is not null
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
    from public.soil_list_phone p
    join selected_phones t on t."電話番号" = p."電話番号"
    where p_axis in ('vendor', 'line_type', 'contract_year')
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

revoke all on function public.soil_list_analysis_axis_segment(text, text, text, date) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_vendor_and(text[], text) from public, anon, authenticated;
grant execute on function public.soil_list_analysis_axis_segment(text, text, text, date) to service_role;
grant execute on function public.soil_list_analysis_vendor_and(text[], text) to service_role;

comment on column public.soil_list_phone."受注案件数" is '受注履歴の顧客一覧レコード番号の distinct 件数。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_analysis_cell.order_case_count is '受注案件数。受注履歴の顧客一覧レコード番号 distinct 件数の合計。';
comment on function public.soil_list_analysis_vendor_and(text[], text) is '分析①の購入先複数選択（かつ）用。選んだ購入先すべてに購入履歴がある番号だけを DB 直結で集計する。';

commit;
