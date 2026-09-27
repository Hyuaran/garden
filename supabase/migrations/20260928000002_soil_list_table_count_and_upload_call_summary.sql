create table if not exists public.soil_list_table_count (
  table_name text primary key,
  row_count bigint not null,
  counted_at timestamptz not null default now()
);

alter table public.soil_list_table_count enable row level security;
grant all on public.soil_list_table_count to service_role;
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
  v_source_kind text := 'import_file';
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_applied_at timestamptz := now();
begin
  select u.created_at, nullif(u."購入先", ''), u."購入日", coalesce(u.source_kind, 'import_file')
    into v_upload_created_at, v_purchase_vendor, v_purchase_date, v_source_kind
  from public.soil_list_upload u
  where u.id = p_upload_id;

  if v_source_kind <> 'export' and (v_purchase_vendor is null or v_purchase_date is null) then
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
    where v_source_kind <> 'export'
      and not exists (
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
    where v_source_kind <> 'export'
      and not exists (
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
  set "コール回数合計" = s.total,
      "最終コール日_集約" = s.last_day,
      "最終コール結果" = s.last_result
  from (
    select c."電話番号",
           sum(coalesce(c."コール回数", 0))::integer as total,
           max(c."最終コール日") as last_day,
           (array_agg(c."最終結果" order by c."最終コール日" desc nulls last, c.ctid desc))[1] as last_result
    from public.soil_list_call c
    join soil_list_upload_new_phone n on n."電話番号" = c."電話番号"
    group by c."電話番号"
  ) s
  where s."電話番号" = p."電話番号";

  if v_source_kind <> 'export' then
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
  end if;

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
revoke all on function public.soil_list_apply_upload(uuid, integer) from public, anon, authenticated;
grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role;
