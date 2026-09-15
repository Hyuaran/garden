-- リストマスタ：元回線・契約時期・区分を電話番号台帳に持たせる
-- 実行と一括投入は Claude が DB 直結で行う。この migration は定義だけを置く。
begin;

alter table public.soil_list_phone
  add column if not exists "契約時期" date,
  add column if not exists "区分" text,
  add column if not exists "区分_判定元" text,
  add column if not exists "派生更新_at" timestamptz;

create index if not exists soil_list_phone_line_type_idx on public.soil_list_phone ("元回線");
create index if not exists soil_list_phone_category_idx on public.soil_list_phone ("区分");
create index if not exists soil_list_phone_contract_month_idx on public.soil_list_phone ("契約時期");

create or replace function public.soil_list_derive_line_type(
  list_name text,
  judge_item text,
  purchase_vendor_new text
)
returns text
language plpgsql
immutable
as $$
declare
  v_list text := coalesce(list_name, '');
  v_list_upper text := upper(coalesce(list_name, ''));
  v_judge text := coalesce(judge_item, '');
  v_vendor text := coalesce(purchase_vendor_new, '');
  v_matches text[] := array[]::text[];
begin
  if v_list like '%アナログ%' then
    return 'アナログ';
  end if;
  if v_list like '%フレッツ%' or v_list like '%F×転用%' then
    return 'フレッツ';
  end if;
  if v_list_upper like '%AU%' or v_list like '%au光%' or v_list like '%auひかり%' then
    return 'au';
  end if;

  if v_judge like '%アナログ - NTT%' then
    v_matches := array_append(v_matches, 'アナログ');
  end if;
  if v_judge like '%フレッツ%' then
    v_matches := array_append(v_matches, 'フレッツ');
  end if;
  if v_judge like '%auひかり%' then
    v_matches := array_append(v_matches, 'au');
  end if;

  if cardinality(v_matches) = 1 then
    return v_matches[1];
  end if;
  if cardinality(v_matches) >= 2 then
    return '混在';
  end if;

  if v_vendor like '%アナログ%' then
    return 'アナログ';
  end if;
  if v_vendor like '%フレッツ%' then
    return 'フレッツ';
  end if;

  return null;
end;
$$;

create or replace function public.soil_list_derive_contract_month(
  latest_purchase_on date,
  elapsed_months integer
)
returns date
language sql
immutable
as $$
  select case
    when latest_purchase_on is null or elapsed_months is null then null
    else (
      case
        when latest_purchase_on >= date '2025-12-01' then date '2025-12-01'
        else date_trunc('month', latest_purchase_on)::date
      end - make_interval(months => elapsed_months)
    )::date
  end
$$;

create or replace function public.soil_list_derive_category(name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text := coalesce(name, '');
  v_corporate_terms constant text[] := array[
    '株式会社','有限会社','合同会社','合資会社','（株）','(株)','（有）','(有)',
    '社団法人','財団法人','医療法人','学校法人','社会福祉法人','宗教法人','組合'
  ];
  v_shop_terms constant text[] := array[
    '商店','商会','工務店','建設','工業','クリニック','医院','歯科','事務所',
    '不動産','自動車','整備','電気','設備','美容','理容','サロン','食堂',
    '寿司','薬局','農園','牧場','水産','運送','興業','産業','企画',
    'サービス','システム','センター','工房','教室','塾'
  ];
  v_suffix_terms constant text[] := array['屋','店','院','園','堂','館','社','組','亭'];
  v_term text;
begin
  if nullif(v_name, '') is null then
    return null;
  end if;

  foreach v_term in array v_corporate_terms loop
    if v_name like '%' || v_term || '%' then
      return '法人';
    end if;
  end loop;

  foreach v_term in array v_shop_terms loop
    if v_name like '%' || v_term || '%' then
      return '屋号';
    end if;
  end loop;

  foreach v_term in array v_suffix_terms loop
    if v_name like '%' || v_term then
      return '屋号';
    end if;
  end loop;

  return '個人';
end;
$$;

create or replace function public.soil_list_backfill_derived(p_limit integer default 50000)
returns table (updated integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 50000), 50000));
  v_updated integer := 0;
  v_remaining integer := 0;
begin
  -- 電話番号が空の行（約 9.8 万）は「is not distinct from」で突合すると null 同士が総当たりになって終わらないので、
  -- ここでは電話番号のある行だけを一意索引の効く「=」で突合する。空番号の行は別に 1 回の update で処理する（2026-09-15 Claude）
  create temp table soil_list_derived_batch on commit drop as
    select p."電話番号"
    from public.soil_list_phone p
    where p."派生更新_at" is null
      and p."区分_判定元" is distinct from '手入力'
      and p."電話番号" is not null
      and p."電話番号" <> ''
    order by p."電話番号" asc
    limit v_limit;

  update public.soil_list_phone p
  set
    "元回線" = coalesce(nullif(p."元回線", ''), public.soil_list_derive_line_type(p."リスト名", p."判定項目", p."最新購入先")),
    "契約時期" = public.soil_list_derive_contract_month(p."最新購入日", p."経過月数"),
    "区分" = public.soil_list_derive_category(p."氏名"),
    "区分_判定元" = case
      when public.soil_list_derive_category(p."氏名") is null then null
      else '自動'
    end,
    "派生更新_at" = now()
  from soil_list_derived_batch b
  where p."電話番号" = b."電話番号";
  get diagnostics v_updated = row_count;

  select count(*)::integer into v_remaining
  from public.soil_list_phone p
  where p."派生更新_at" is null
    and p."区分_判定元" is distinct from '手入力'
    and p."電話番号" is not null
    and p."電話番号" <> '';

  return query select v_updated, v_remaining;
end;
$$;

create or replace function public.soil_list_refresh_options() returns void language plpgsql as $$
declare c text;
begin
  delete from public.soil_list_option;
  foreach c in array array['住所_都道府県','AU光架電可否','購入状態','アポ禁','判定結果','東西','元回線','区分'] loop
    execute format(
      'insert into public.soil_list_option (column_name, value, row_count) select %L, coalesce(%I, ''''), count(*) from public.soil_list_phone group by 1, 2',
      c, c);
  end loop;
end $$;

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

  insert into public.soil_list_purchase ("電話番号", "購入先", "購入先_NEW", "購入日")
  select n."電話番号", v_purchase_vendor, v_purchase_vendor, v_purchase_date
  from soil_list_upload_new_phone n
  where not exists (
    select 1
    from public.soil_list_purchase sp
    where sp."電話番号" = n."電話番号"
      and coalesce(sp."購入先", '') = v_purchase_vendor
      and sp."購入日" = v_purchase_date
  );
  get diagnostics v_purchase_inserted = row_count;

  select count(*)::integer into v_parent_kept
  from soil_list_upload_target t
  join public.soil_list_phone p on p."電話番号" = t."電話番号"
  where p."リスト投入日" is not null
    and t."リスト投入日" is not null
    and p."リスト投入日" > t."リスト投入日";

  select count(*)::integer into v_line_type_set
  from soil_list_upload_target t
  join public.soil_list_phone p on p."電話番号" = t."電話番号"
  where nullif(p."元回線", '') is null
    and t.line_type is not null
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
      "元回線" = coalesce(nullif(p."元回線", ''), t.line_type),
      "区分" = case
        when nullif(p."区分", '') is null and p."区分_判定元" is distinct from '手入力' then t.category
        else p."区分"
      end,
      "区分_判定元" = case
        when nullif(p."区分", '') is null and p."区分_判定元" is distinct from '手入力' and t.category is not null then '自動'
        else p."区分_判定元"
      end
  from soil_list_upload_target t
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
    true
  from soil_list_upload_new_phone n;
  get diagnostics v_parent_inserted = row_count;

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
    v_line_type_set,
    v_category_set;
end;
$$;

revoke all on function public.soil_list_derive_line_type(text, text, text) from public, anon, authenticated;
revoke all on function public.soil_list_derive_contract_month(date, integer) from public, anon, authenticated;
revoke all on function public.soil_list_derive_category(text) from public, anon, authenticated;
revoke all on function public.soil_list_backfill_derived(integer) from public, anon, authenticated;
revoke all on function public.soil_list_apply_upload(uuid, integer) from public, anon, authenticated;
grant execute on function public.soil_list_derive_line_type(text, text, text) to service_role;
grant execute on function public.soil_list_derive_contract_month(date, integer) to service_role;
grant execute on function public.soil_list_derive_category(text) to service_role;
grant execute on function public.soil_list_backfill_derived(integer) to service_role;
grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role;

comment on column public.soil_list_phone."元回線" is 'リスト名、判定項目、購入先_NEW の順で決めた回線の種類。空欄の既存値だけ自動で埋める。';
comment on column public.soil_list_phone."契約時期" is '最新購入日と経過月数から逆算した契約の年月。月初の日付で持つ。購入日または経過月数が無い番号は空欄。';
comment on column public.soil_list_phone."区分" is '氏名の言葉から自動で決めた個人・屋号・法人。一覧で手入力に直せる。';
comment on column public.soil_list_phone."区分_判定元" is '区分の決め方。自動または手入力。手入力の行は一括投入とアップロードで上書きしない。';
comment on column public.soil_list_phone."派生更新_at" is '元回線・契約時期・区分の一括投入で処理済みを示す作業列。';
comment on function public.soil_list_derive_line_type(text, text, text) is 'リスト名、判定項目、購入先_NEW の順で元回線を決める。';
comment on function public.soil_list_derive_contract_month(date, integer) is '最新購入日と経過月数から契約時期（月初）を逆算する。購入日なしは推定しない。';
comment on function public.soil_list_derive_category(text) is '氏名の言葉から個人・屋号・法人を決める。';
comment on function public.soil_list_backfill_derived(integer) is '電話番号台帳へ元回線・契約時期・区分を p_limit 件ずつ一括投入する。';
comment on function public.soil_list_apply_upload(uuid, integer) is '投入履歴を p_limit 件ずつ反映する。新規番号は購入履歴へ 1 行入れてから電話番号台帳へ追加し、元回線と区分も付ける。';

commit;
