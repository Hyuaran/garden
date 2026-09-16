-- リストマスタ：買い直しを購入履歴に残し、分析で見えるようにする。
-- migration は書くだけ。実行は Claude が行う。
begin;

create index if not exists soil_list_purchase_phone_purchase_vendor_date_idx
  on public.soil_list_purchase ("電話番号", "購入日", (coalesce(nullif("購入先_NEW", ''), "購入先")));

create index if not exists soil_list_purchase_phone_purchase_date_idx
  on public.soil_list_purchase ("電話番号", "購入日" desc);

create table if not exists public.soil_list_analysis_vendor_repurchase (
  segment text primary key,
  repurchase_count integer not null default 0,
  source_summary text not null default ''
);

create table if not exists public.soil_list_analysis_repurchase_pair (
  source_vendor text not null,
  target_vendor text not null,
  phone_count integer not null default 0,
  order_count integer not null default 0,
  primary key (source_vendor, target_vendor)
);

create table if not exists public.soil_list_analysis_purchase_filter_cell (
  vendor text not null,
  line_type text not null,
  contract_year text not null,
  result text not null,
  row_count integer not null default 0,
  called_count integer not null default 0,
  call_total integer not null default 0,
  invalid_count integer not null default 0,
  order_count integer not null default 0,
  order_case_count integer not null default 0,
  acquired_count integer not null default 0,
  primary key (vendor, line_type, contract_year, result)
);

alter table public.soil_list_analysis_vendor_repurchase enable row level security;
alter table public.soil_list_analysis_repurchase_pair enable row level security;
alter table public.soil_list_analysis_purchase_filter_cell enable row level security;
revoke all on table public.soil_list_analysis_vendor_repurchase from public, anon, authenticated;
revoke all on table public.soil_list_analysis_repurchase_pair from public, anon, authenticated;
revoke all on table public.soil_list_analysis_purchase_filter_cell from public, anon, authenticated;
grant all on table public.soil_list_analysis_vendor_repurchase to service_role;
grant all on table public.soil_list_analysis_repurchase_pair to service_role;
grant all on table public.soil_list_analysis_purchase_filter_cell to service_role;

drop function if exists public.soil_list_apply_upload(uuid);
drop function if exists public.soil_list_apply_upload(uuid, integer);

create or replace function public.soil_list_apply_upload(p_upload_id uuid, p_limit integer default 1000)
returns table (
  assignments integer,
  assignments_new integer,
  assignments_updated integer,
  parent_updated integer,
  parent_inserted integer,
  parent_kept integer,
  skipped integer,
  remaining integer,
  purchase_inserted integer,
  purchase_initial_inserted integer,
  purchase_repurchase_inserted integer,
  line_type_set integer,
  category_set integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignments integer := 0;
  v_assignments_new integer := 0;
  v_assignments_updated integer := 0;
  v_parent_updated integer := 0;
  v_parent_inserted integer := 0;
  v_parent_kept integer := 0;
  v_skipped integer := 0;
  v_remaining integer := 0;
  v_purchase_inserted integer := 0;
  v_purchase_initial_inserted integer := 0;
  v_purchase_repurchase_inserted integer := 0;
  v_line_type_set integer := 0;
  v_category_set integer := 0;
  v_upload_created_at timestamptz;
  v_purchase_vendor text;
  v_purchase_date date;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_applied_at timestamptz := now();
begin
  select u.created_at, nullif(u."購入先", ''), u."購入日"
    into v_upload_created_at, v_purchase_vendor, v_purchase_date
  from public.soil_list_upload u
  where u.id = p_upload_id;

  if v_purchase_vendor is null or v_purchase_date is null then
    raise exception 'purchase_vendor_required';
  end if;

  create temp table soil_list_upload_batch on commit drop as
    select a.*
    from public.soil_list_assignment a
    where a.upload_id = p_upload_id
      and a.applied_at is null
    order by a."リスト投入日" asc nulls last, a.updated_at asc, a."電話番号" asc, a."リスト名" asc
    limit v_limit;

  select count(*)::integer into v_assignments from soil_list_upload_batch;

  select count(*)::integer into v_assignments_new
  from soil_list_upload_batch a
  where v_upload_created_at is not null
    and a.created_at >= v_upload_created_at;
  v_assignments_updated := greatest(v_assignments - v_assignments_new, 0);

  select count(*)::integer into v_skipped
  from soil_list_upload_batch a
  where a."要確認の理由" is not null;

  create temp table soil_list_upload_target on commit drop as
    select distinct on (a."電話番号")
      a."電話番号",
      a."リスト名",
      a."リスト投入日",
      coalesce(nullif(a."既契約者名_姓", ''), nullif(a."申込者名_姓", ''), nullif(a."連絡担当者名_姓", '')) as last_name,
      coalesce(nullif(a."既契約者名_名", ''), nullif(a."申込者名_名", ''), nullif(a."連絡担当者名_名", '')) as first_name,
      nullif(concat_ws(' ', coalesce(nullif(a."既契約者名_姓", ''), nullif(a."申込者名_姓", ''), nullif(a."連絡担当者名_姓", '')), coalesce(nullif(a."既契約者名_名", ''), nullif(a."申込者名_名", ''), nullif(a."連絡担当者名_名", ''))), '') as full_name,
      case
        when coalesce(nullif(a."既契約者名_生年月日", ''), nullif(a."申込者名_生年月日", ''), nullif(a."連絡担当者名_生年月日", '')) ~ '^\d{4}[-/]\d{1,2}[-/]\d{1,2}$'
          then to_date(replace(coalesce(nullif(a."既契約者名_生年月日", ''), nullif(a."申込者名_生年月日", ''), nullif(a."連絡担当者名_生年月日", '')), '/', '-'), 'YYYY-MM-DD')
        else null
      end as birthday,
      nullif(a."設置先_郵便番号", '') as postal_code,
      nullif(a."設置先_住所_都道府県", '') as prefecture,
      nullif(a."設置先_住所_市町村", '') as city,
      nullif(a."設置先_住所_町域", '') as town,
      nullif(concat_ws(' ', nullif(a."設置先_住所_建物名", ''), nullif(a."設置先_住所_部屋番号", '')), '') as block,
      nullif(a."携帯番号_ハイフンなし", '') as mobile_number,
      public.soil_list_derive_line_type(a."リスト名", null, null) as line_type,
      public.soil_list_derive_category(nullif(concat_ws(' ', coalesce(nullif(a."既契約者名_姓", ''), nullif(a."申込者名_姓", ''), nullif(a."連絡担当者名_姓", '')), coalesce(nullif(a."既契約者名_名", ''), nullif(a."申込者名_名", ''), nullif(a."連絡担当者名_名", ''))), '')) as category
    from soil_list_upload_batch a
    where a."要確認の理由" is null
      and a."電話番号" <> ''
    order by a."電話番号", a."リスト投入日" desc nulls last, a.updated_at desc;

  create temp table soil_list_upload_new_phone on commit drop as
    select t.*
    from soil_list_upload_target t
    where not exists (
      select 1 from public.soil_list_phone p where p."電話番号" = t."電話番号"
    );

  create temp table soil_list_purchase_insert_target on commit drop as
    select
      t."電話番号",
      not exists (
        select 1 from public.soil_list_purchase prior
        where prior."電話番号" = t."電話番号"
      ) as is_initial
    from soil_list_upload_target t
    where not exists (
      select 1
      from public.soil_list_purchase sp
      where sp."電話番号" = t."電話番号"
        and coalesce(nullif(sp."購入先_NEW", ''), sp."購入先") = v_purchase_vendor
        and sp."購入日" = v_purchase_date
    );

  insert into public.soil_list_purchase ("電話番号", "購入先", "購入先_NEW", "購入日")
  select n."電話番号", v_purchase_vendor, v_purchase_vendor, v_purchase_date
  from soil_list_purchase_insert_target n;
  get diagnostics v_purchase_inserted = row_count;

  select
    count(*) filter (where is_initial)::integer,
    count(*) filter (where not is_initial)::integer
  into v_purchase_initial_inserted, v_purchase_repurchase_inserted
  from soil_list_purchase_insert_target;

  select count(*)::integer into v_parent_kept
  from soil_list_upload_target t
  join public.soil_list_phone p on p."電話番号" = t."電話番号"
  where p."リスト投入日" is not null
    and t."リスト投入日" is not null
    and p."リスト投入日" > t."リスト投入日";

  select count(*)::integer into v_line_type_set
  from soil_list_upload_target t
  join public.soil_list_phone p on p."電話番号" = t."電話番号"
  left join lateral (
    select coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor
    from public.soil_list_purchase sp
    where sp."電話番号" = t."電話番号"
    order by sp."購入日" desc nulls last, sp.ctid desc
    limit 1
  ) purchase_latest on true
  where nullif(p."元回線", '') is null
    and coalesce(t.line_type, public.soil_list_derive_line_type(null, null, purchase_latest.vendor)) is not null
    and (
      p."リスト投入日" is null
      or t."リスト投入日" is null
      or p."リスト投入日" <= t."リスト投入日"
    );

  select count(*)::integer into v_category_set
  from soil_list_upload_target t
  join public.soil_list_phone p on p."電話番号" = t."電話番号"
  where nullif(p."区分", '') is null
    and p."区分_判定元" is distinct from '手入力'
    and t.category is not null
    and (
      p."リスト投入日" is null
      or t."リスト投入日" is null
      or p."リスト投入日" <= t."リスト投入日"
    );

  update public.soil_list_phone p
  set "リスト名" = t."リスト名",
      "リスト投入日" = t."リスト投入日",
      "氏名_姓" = coalesce(nullif(p."氏名_姓", ''), t.last_name),
      "氏名_名" = coalesce(nullif(p."氏名_名", ''), t.first_name),
      "氏名" = coalesce(nullif(p."氏名", ''), t.full_name),
      "生年月日" = coalesce(p."生年月日", t.birthday),
      "郵便番号" = coalesce(nullif(p."郵便番号", ''), t.postal_code),
      "住所_都道府県" = coalesce(nullif(p."住所_都道府県", ''), t.prefecture),
      "住所_市区町村" = coalesce(nullif(p."住所_市区町村", ''), t.city),
      "住所_町名" = coalesce(nullif(p."住所_町名", ''), t.town),
      "住所_番地" = coalesce(nullif(p."住所_番地", ''), t.block),
      "携帯番号" = coalesce(nullif(p."携帯番号", ''), t.mobile_number),
      "元回線" = coalesce(nullif(p."元回線", ''), t.line_type, public.soil_list_derive_line_type(null, null, purchase_latest.vendor)),
      "区分" = case
        when nullif(p."区分", '') is null and p."区分_判定元" is distinct from '手入力' then t.category
        else p."区分"
      end,
      "区分_判定元" = case
        when nullif(p."区分", '') is null and p."区分_判定元" is distinct from '手入力' and t.category is not null then '自動'
        else p."区分_判定元"
      end
  from soil_list_upload_target t
  left join lateral (
    select coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor
    from public.soil_list_purchase sp
    where sp."電話番号" = t."電話番号"
    order by sp."購入日" desc nulls last, sp.ctid desc
    limit 1
  ) purchase_latest on true
  where p."電話番号" = t."電話番号"
    and (
      p."リスト投入日" is null
      or t."リスト投入日" is null
      or p."リスト投入日" <= t."リスト投入日"
    );
  get diagnostics v_parent_updated = row_count;

  insert into public.soil_list_phone (
    "電話番号",
    "氏名_姓",
    "氏名_名",
    "氏名",
    "生年月日",
    "郵便番号",
    "住所_都道府県",
    "住所_市区町村",
    "住所_町名",
    "住所_番地",
    "携帯番号",
    "リスト名",
    "リスト投入日",
    "元回線",
    "区分",
    "区分_判定元",
    "データ出所",
    "最新購入先",
    "最新購入日",
    "契約時期",
    "購入履歴あり"
  )
  select
    n."電話番号",
    n.last_name,
    n.first_name,
    n.full_name,
    n.birthday,
    n.postal_code,
    n.prefecture,
    n.city,
    n.town,
    n.block,
    n.mobile_number,
    n."リスト名",
    n."リスト投入日",
    n.line_type,
    n.category,
    case when n.category is null then null else '自動' end,
    'Garden投入',
    v_purchase_vendor,
    v_purchase_date,
    public.soil_list_derive_contract_month(v_purchase_date, null),
    true
  from soil_list_upload_new_phone n;
  get diagnostics v_parent_inserted = row_count;

  update public.soil_list_phone p
  set
    "最新購入先" = latest.vendor,
    "最新購入日" = latest.purchased_on,
    "契約時期" = public.soil_list_derive_contract_month(latest.purchased_on, p."経過月数"),
    "購入履歴あり" = true
  from (
    select distinct t."電話番号" from soil_list_upload_target t
  ) target
  join lateral (
    select
      coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor,
      sp."購入日" as purchased_on
    from public.soil_list_purchase sp
    where sp."電話番号" = target."電話番号"
    order by sp."購入日" desc nulls last, sp.ctid desc
    limit 1
  ) latest on true
  where p."電話番号" = target."電話番号";

  select v_line_type_set + count(*)::integer into v_line_type_set
  from soil_list_upload_new_phone n
  where n.line_type is not null;

  select v_category_set + count(*)::integer into v_category_set
  from soil_list_upload_new_phone n
  where n.category is not null;

  update public.soil_list_assignment a
  set applied_at = v_applied_at,
      updated_at = v_applied_at
  from soil_list_upload_batch b
  where a."電話番号" = b."電話番号"
    and a."リスト名" = b."リスト名";

  select count(*)::integer into v_remaining
  from public.soil_list_assignment a
  where a.upload_id = p_upload_id
    and a.applied_at is null;

  return query select
    v_assignments,
    v_assignments_new,
    v_assignments_updated,
    v_parent_updated,
    v_parent_inserted,
    v_parent_kept,
    v_skipped,
    v_remaining,
    v_purchase_inserted,
    v_purchase_initial_inserted,
    v_purchase_repurchase_inserted,
    v_line_type_set,
    v_category_set;
end;
$$;

create or replace function public.soil_list_backfill_repurchases(p_limit integer default 1000)
returns table (target_count integer, inserted integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_target_count integer := 0;
  v_inserted integer := 0;
  v_remaining integer := 0;
begin
  create temp table soil_list_backfill_candidates on commit drop as
    select distinct
      a."電話番号",
      nullif(u."購入先", '') as purchase_vendor,
      u."購入日" as purchase_date
    from public.soil_list_upload u
    join public.soil_list_assignment a on a.upload_id = u.id
    where nullif(u."購入先", '') is not null
      and u."購入日" is not null
      and a."電話番号" is not null
      and a."電話番号" <> ''
      and not exists (
        select 1
        from public.soil_list_purchase sp
        where sp."電話番号" = a."電話番号"
          and coalesce(nullif(sp."購入先_NEW", ''), sp."購入先") = nullif(u."購入先", '')
          and sp."購入日" = u."購入日"
      )
    order by u."購入日" asc, nullif(u."購入先", ''), a."電話番号"
    limit v_limit;

  select count(*)::integer into v_target_count from soil_list_backfill_candidates;

  insert into public.soil_list_purchase ("電話番号", "購入先", "購入先_NEW", "購入日")
  select c."電話番号", c.purchase_vendor, c.purchase_vendor, c.purchase_date
  from soil_list_backfill_candidates c;
  get diagnostics v_inserted = row_count;

  update public.soil_list_phone p
  set
    "最新購入先" = latest.vendor,
    "最新購入日" = latest.purchased_on,
    "契約時期" = public.soil_list_derive_contract_month(latest.purchased_on, p."経過月数"),
    "購入履歴あり" = true
  from (
    select distinct c."電話番号" from soil_list_backfill_candidates c
  ) target
  join lateral (
    select
      coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor,
      sp."購入日" as purchased_on
    from public.soil_list_purchase sp
    where sp."電話番号" = target."電話番号"
    order by sp."購入日" desc nulls last, sp.ctid desc
    limit 1
  ) latest on true
  where p."電話番号" = target."電話番号";

  select count(*)::integer into v_remaining
  from (
    select distinct a."電話番号", nullif(u."購入先", '') as purchase_vendor, u."購入日" as purchase_date
    from public.soil_list_upload u
    join public.soil_list_assignment a on a.upload_id = u.id
    where nullif(u."購入先", '') is not null
      and u."購入日" is not null
      and a."電話番号" is not null
      and a."電話番号" <> ''
      and not exists (
        select 1
        from public.soil_list_purchase sp
        where sp."電話番号" = a."電話番号"
          and coalesce(nullif(sp."購入先_NEW", ''), sp."購入先") = nullif(u."購入先", '')
          and sp."購入日" = u."購入日"
      )
  ) rest;

  return query select v_target_count, v_inserted, v_remaining;
end;
$$;

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
    from public.soil_list_phone p
    -- 購入先の絞り込みは left join で（where の or + exists だと 267 万行を 1 行ずつ引いて 120 秒超え・2026-09-16 実測）
    left join selected_phones t on t."電話番号" = p."電話番号"
    where p_axis in ('vendor', 'line_type', 'contract_year')
      and p."電話番号" is not null and p."電話番号" <> ''
      and ((select count(*) from selected_vendors) = 0 or t."電話番号" is not null)
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
  select *
  from public.soil_list_analysis_filtered(p_vendors, array[]::text[], array[]::text[], p_axis);
$$;

create or replace function public.soil_list_analysis_finish(p_started_at timestamptz default null)
returns table (refreshed_at timestamptz, rows integer, elapsed_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed_at timestamptz := now();
  v_rows integer;
  v_elapsed_ms integer;
begin
  truncate table public.soil_list_analysis_vendor_repurchase;
  truncate table public.soil_list_analysis_repurchase_pair;
  truncate table public.soil_list_analysis_purchase_filter_cell;

  with normalized as (
    select
      sp."電話番号",
      coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) as vendor,
      sp."購入日" as purchased_on,
      sp.ctid as row_tid
    from public.soil_list_purchase sp
    where sp."電話番号" is not null
      and sp."電話番号" <> ''
      and coalesce(nullif(sp."購入先_NEW", ''), nullif(sp."購入先", '')) is not null
      and sp."購入日" is not null
  ),
  ordered as (
    select
      n.*,
      lag(n.vendor) over (partition by n."電話番号" order by n.purchased_on, n.row_tid) as source_vendor,
      lag(n.purchased_on) over (partition by n."電話番号" order by n.purchased_on, n.row_tid) as source_purchased_on
    from normalized n
  ),
  pairs as (
    select
      o."電話番号",
      o.source_vendor,
      o.vendor as target_vendor,
      o.purchased_on as target_purchased_on
    from ordered o
    where o.source_vendor is not null
      and o.source_vendor <> o.vendor
      and o.source_purchased_on <= o.purchased_on
  )
  insert into public.soil_list_analysis_repurchase_pair (source_vendor, target_vendor, phone_count, order_count)
  select
    p.source_vendor,
    p.target_vendor,
    count(distinct p."電話番号")::integer as phone_count,
    count(distinct p."電話番号") filter (
      where exists (
        select 1
        from public.soil_list_order o
        where o."電話番号" = p."電話番号"
          and o."受注日" > p.target_purchased_on
      )
    )::integer as order_count
  from pairs p
  group by p.source_vendor, p.target_vendor;

  with target_totals as (
    select
      target_vendor as segment,
      sum(phone_count)::integer as repurchase_count
    from public.soil_list_analysis_repurchase_pair
    group by target_vendor
  ),
  source_rank as (
    select
      target_vendor as segment,
      source_vendor,
      sum(phone_count)::integer as phone_count,
      row_number() over (partition by target_vendor order by sum(phone_count) desc, source_vendor) as rn
    from public.soil_list_analysis_repurchase_pair
    group by target_vendor, source_vendor
  )
  insert into public.soil_list_analysis_vendor_repurchase (segment, repurchase_count, source_summary)
  select
    t.segment,
    t.repurchase_count,
    coalesce(string_agg(r.source_vendor || ' ' || r.phone_count::text, '／' order by r.phone_count desc, r.source_vendor), '') as source_summary
  from target_totals t
  left join source_rank r on r.segment = t.segment and r.rn <= 3
  group by t.segment, t.repurchase_count;

  insert into public.soil_list_analysis_purchase_filter_cell (
    vendor, line_type, contract_year, result,
    row_count, called_count, call_total, invalid_count, order_count, order_case_count, acquired_count
  )
  select
    coalesce(nullif(p."最新購入先", ''), '（購入先なし）') as vendor,
    coalesce(nullif(p."元回線", ''), '（元回線なし）') as line_type,
    coalesce(to_char(p."契約時期", 'YYYY'), '（契約時期なし）') as contract_year,
    case
      when coalesce(p."コール回数合計", 0) = 0 then '未コール'
      else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
    end as result,
    count(*)::integer as row_count,
    count(*) filter (where coalesce(p."コール回数合計", 0) > 0)::integer as called_count,
    sum(coalesce(p."コール回数合計", 0))::integer as call_total,
    count(*) filter (where public.soil_list_normalize_call_result(p."最終コール結果") = '無効')::integer as invalid_count,
    count(*) filter (where coalesce(p."受注件数", 0) > 0)::integer as order_count,
    sum(coalesce(p."受注案件数", 0))::integer as order_case_count,
    count(*) filter (where public.soil_list_normalize_call_result(p."最終コール結果") = '獲得')::integer as acquired_count
  from public.soil_list_phone p
  where p."電話番号" is not null and p."電話番号" <> ''
  group by
    coalesce(nullif(p."最新購入先", ''), '（購入先なし）'),
    coalesce(nullif(p."元回線", ''), '（元回線なし）'),
    coalesce(to_char(p."契約時期", 'YYYY'), '（契約時期なし）'),
    case
      when coalesce(p."コール回数合計", 0) = 0 then '未コール'
      else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
    end;

  truncate table public.soil_list_analysis_cell;
  insert into public.soil_list_analysis_cell select * from public.soil_list_analysis_cell_next;
  get diagnostics v_rows = row_count;

  v_elapsed_ms := case
    when p_started_at is null then 0
    else floor(extract(epoch from (clock_timestamp() - p_started_at)) * 1000)::integer
  end;

  update public.soil_list_analysis_state
  set refreshed_at = v_refreshed_at,
      last_elapsed_ms = v_elapsed_ms,
      last_error = null,
      rows = v_rows,
      updated_at = v_refreshed_at
  where id = 1;

  return query select v_refreshed_at, v_rows, v_elapsed_ms;
end;
$$;

revoke all on function public.soil_list_apply_upload(uuid, integer) from public, anon, authenticated;
revoke all on function public.soil_list_backfill_repurchases(integer) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_filtered(text[], text[], text[], text) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_vendor_and(text[], text) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_finish(timestamptz) from public, anon, authenticated;
grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role;
grant execute on function public.soil_list_backfill_repurchases(integer) to service_role;
grant execute on function public.soil_list_analysis_filtered(text[], text[], text[], text) to service_role;
grant execute on function public.soil_list_analysis_vendor_and(text[], text) to service_role;
grant execute on function public.soil_list_analysis_finish(timestamptz) to service_role;

comment on function public.soil_list_apply_upload(uuid, integer) is '投入履歴を p_limit 件ずつ反映する。購入履歴は番号×購入先×購入日で 1 行にし、買い直しも残す。';
comment on function public.soil_list_backfill_repurchases(integer) is '過去の投入履歴から番号×購入先×購入日を補完し、購入履歴に無い買い直しを p_limit 件ずつ足す。';
comment on function public.soil_list_analysis_filtered(text[], text[], text[], text) is '分析①の購入先・元回線・契約時期フィルターを同時に効かせて集計する。購入先は複数指定時にすべてに購入履歴がある番号だけを数える。';
comment on table public.soil_list_analysis_vendor_repurchase is '分析①の購入先ごとの買い直し数と買い直し元の上位。';
comment on table public.soil_list_analysis_repurchase_pair is '分析の買い直し組み合わせ。先に買った購入先から後で買った購入先への隣り合う購入履歴を数える。';
comment on table public.soil_list_analysis_purchase_filter_cell is '分析①の絞り込み用の基礎集計。購入先×元回線×契約時期年×コール結果で持つ。';

commit;
