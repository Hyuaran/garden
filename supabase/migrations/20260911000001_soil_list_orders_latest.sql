-- リストマスタ：受注履歴を新設し、電話番号台帳に 4 つの履歴の最新値を持たせる
-- migration は書くだけ。実行は別担当で行う。
begin;

create table if not exists public.soil_list_order (
  "電話番号" text not null,
  "顧客一覧レコード番号" text not null,
  "営業ID" text,
  "チーム名" text,
  "商材名区分1" text,
  "商材名区分2" text,
  "商流名" text,
  "受注日" date,
  "実績日" date,
  "開通日" date,
  "キャンセル日" date,
  "取込日時" timestamptz not null default now(),
  primary key ("顧客一覧レコード番号", "電話番号")
);

create index if not exists soil_list_order_phone_idx on public.soil_list_order ("電話番号");

alter table public.soil_list_order enable row level security;
revoke all on table public.soil_list_order from public, anon, authenticated;
grant all on table public.soil_list_order to service_role;

create table if not exists public.soil_list_order_sync_state (
  id integer primary key default 1 check (id = 1),
  last_run_at timestamptz,
  last_records integer not null default 0,
  last_order_rows integer not null default 0,
  last_phone_updates integer not null default 0,
  last_deleted_rows integer not null default 0,
  last_elapsed_ms integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

insert into public.soil_list_order_sync_state (id)
values (1)
on conflict (id) do nothing;

alter table public.soil_list_order_sync_state enable row level security;
revoke all on table public.soil_list_order_sync_state from public, anon, authenticated;
grant all on table public.soil_list_order_sync_state to service_role;

alter table public.soil_list_phone
  add column if not exists "最新購入先" text,
  add column if not exists "最新購入日" date,
  add column if not exists "最終コール結果" text,
  add column if not exists "最新受注日" date,
  add column if not exists "最新受注商材" text,
  add column if not exists "受注件数" integer not null default 0;

alter table public.soil_list_upload
  add column if not exists "購入先" text,
  add column if not exists "購入日" date;

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

create or replace function public.soil_list_delete_missing_orders(p_record_ids text[])
returns table (deleted_rows integer, phones text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
  v_phones text[] := array[]::text[];
begin
  create temp table soil_list_seen_order_records on commit drop as
    select distinct record_id
    from unnest(coalesce(p_record_ids, array[]::text[])) as record_id
    where record_id is not null and record_id <> '';

  if not exists (select 1 from soil_list_seen_order_records) then
    raise exception 'order_record_ids_empty';
  end if;

  with deleted as (
    delete from public.soil_list_order o
    where not exists (
      select 1
      from soil_list_seen_order_records s
      where s.record_id = o."顧客一覧レコード番号"
    )
    returning o."電話番号"
  )
  select count(*)::integer, coalesce(array_agg(distinct "電話番号"), array[]::text[])
    into v_deleted, v_phones
  from deleted;

  return query select v_deleted, v_phones;
end;
$$;

create or replace function public.soil_list_purchase_vendor_options()
returns table (value text, row_count integer)
language sql
security definer
set search_path = public
as $$
  select vendor as value, count(*)::integer as row_count
  from (
    select coalesce(nullif("購入先_NEW", ''), nullif("購入先", '')) as vendor
    from public.soil_list_purchase
  ) s
  where vendor is not null and vendor <> ''
  group by vendor
  order by count(*) desc, vendor asc
  limit 100;
$$;

create or replace function public.soil_list_refresh_call_summary(p_phones text[] default null)
returns table (phones integer, call_rows integer, synced_through date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since constant date := date '2026-08-01';
  v_from timestamptz;
  v_phones integer := 0;
  v_rows integer := 0;
  v_max date;
begin
  select s.last_run_at - interval '1 day' into v_from from public.soil_list_call_sync_state s where s.id = 1;

  create temp table t_phones on commit drop as
    select distinct h.phone_number as tel
    from public.system_call_history h
    where h.call_date >= v_since
      and h.phone_number is not null
      and (
        (p_phones is not null and h.phone_number = any (p_phones))
        or (p_phones is null and (v_from is null or h.imported_at >= v_from))
      );

  delete from public.soil_list_call c using t_phones t
  where c."電話番号" = t.tel and c."出所" = 'Garden日次';

  insert into public.soil_list_call ("電話番号", "リスト名", "リスト投入日", "コール回数", "初回コール日", "最終コール日", "最終結果", "旧リスト名", "出所")
  select h.phone_number,
         coalesce(h.list_name, ''),
         null,
         count(*)::integer,
         min(h.call_date),
         max(h.call_date),
         (array_agg(h.result_flag order by h.call_date desc, h.call_time desc nulls last, h.id desc))[1],
         max(h.previous_list_name),
         'Garden日次'
  from public.system_call_history h
  join t_phones t on t.tel = h.phone_number
  where h.call_date >= v_since
  group by h.phone_number, coalesce(h.list_name, '');
  get diagnostics v_rows = row_count;

  update public.soil_list_phone p
  set "コール回数合計" = s.total,
      "最終コール日_集約" = s.last_day,
      "最終コール結果" = s.last_result
  from (
    select
      c."電話番号",
      sum(coalesce(c."コール回数", 0))::integer as total,
      max(c."最終コール日") as last_day,
      (array_agg(c."最終結果" order by c."最終コール日" desc nulls last, c.ctid desc))[1] as last_result
    from public.soil_list_call c
    join t_phones t on t.tel = c."電話番号"
    group by c."電話番号"
  ) s
  where s."電話番号" = p."電話番号";
  get diagnostics v_phones = row_count;

  select max(h.call_date) into v_max from public.system_call_history h;
  update public.soil_list_call_sync_state
  set synced_through = v_max, last_run_at = now(), last_phones = v_phones, last_rows = v_rows
  where id = 1;

  return query select v_phones, v_rows, v_max;
end;
$$;

-- 返り値に purchase_inserted を足すため、今の関数（引数 2 つ）を先に消す（返り値の形が変わる関数は create or replace では置き換えられない）
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
  purchase_inserted integer
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
      nullif(a."携帯番号_ハイフンなし", '') as mobile_number
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

  update public.soil_list_phone p
  set "リスト名" = t."リスト名",
      "リスト投入日" = t."リスト投入日",
      "氏名_姓" = coalesce(nullif(p."氏名_姓", ''), t.last_name),
      "氏名_名" = coalesce(nullif(p."氏名_名", ''), t.first_name),
      "氏名" = coalesce(nullif(p."氏名", ''), nullif(concat_ws(' ', t.last_name, t.first_name), '')),
      "生年月日" = coalesce(p."生年月日", t.birthday),
      "郵便番号" = coalesce(nullif(p."郵便番号", ''), t.postal_code),
      "住所_都道府県" = coalesce(nullif(p."住所_都道府県", ''), t.prefecture),
      "住所_市区町村" = coalesce(nullif(p."住所_市区町村", ''), t.city),
      "住所_町名" = coalesce(nullif(p."住所_町名", ''), t.town),
      "住所_番地" = coalesce(nullif(p."住所_番地", ''), t.block),
      "携帯番号" = coalesce(nullif(p."携帯番号", ''), t.mobile_number)
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
    "データ出所",
    "最新購入先",
    "最新購入日",
    "購入履歴あり"
  )
  select
    n."電話番号",
    n.last_name,
    n.first_name,
    nullif(concat_ws(' ', n.last_name, n.first_name), ''),
    n.birthday,
    n.postal_code,
    n.prefecture,
    n.city,
    n.town,
    n.block,
    n.mobile_number,
    n."リスト名",
    n."リスト投入日",
    'Garden投入',
    v_purchase_vendor,
    v_purchase_date,
    true
  from soil_list_upload_new_phone n;
  get diagnostics v_parent_inserted = row_count;

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
    v_purchase_inserted;
end;
$$;

revoke all on function public.soil_list_refresh_phone_latest(text[]) from public, anon, authenticated;
revoke all on function public.soil_list_delete_missing_orders(text[]) from public, anon, authenticated;
revoke all on function public.soil_list_purchase_vendor_options() from public, anon, authenticated;
revoke all on function public.soil_list_refresh_call_summary(text[]) from public, anon, authenticated;
revoke all on function public.soil_list_apply_upload(uuid, integer) from public, anon, authenticated;
grant execute on function public.soil_list_refresh_phone_latest(text[]) to service_role;
grant execute on function public.soil_list_delete_missing_orders(text[]) to service_role;
grant execute on function public.soil_list_purchase_vendor_options() to service_role;
grant execute on function public.soil_list_refresh_call_summary(text[]) to service_role;
grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role;

comment on table public.soil_list_order is 'リストマスタの受注履歴。Kintone 顧客一覧を毎朝取り込み、顧客一覧レコード番号×電話番号で 1 行持つ。';
comment on table public.soil_list_order_sync_state is '受注履歴の毎朝取り込み状態。id=1 の 1 行で最後の結果を表示する。';
comment on column public.soil_list_phone."最新購入先" is '購入履歴から計算した最新の購入先。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_phone."最新購入日" is '購入履歴から計算した最新の購入日。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_phone."最終コール結果" is 'コール履歴から計算した最新の最終結果。soil_list_refresh_call_summary / soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_phone."最新受注日" is '受注履歴から計算した最新の受注日。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_phone."最新受注商材" is '最新受注日の受注履歴から計算した商材名区分2（空なら商材名区分1）。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_phone."受注件数" is '受注履歴の件数。soil_list_refresh_phone_latest で作り直す。';
comment on column public.soil_list_upload."購入先" is '初めての電話番号を購入履歴に入れるときの購入先。アップロード単位で指定する。';
comment on column public.soil_list_upload."購入日" is '初めての電話番号を購入履歴に入れるときの購入日。アップロードした日の日本時間。';
comment on function public.soil_list_refresh_phone_latest(text[]) is '渡した電話番号だけ、購入履歴・投入履歴・コール履歴・受注履歴から電話番号台帳の最新列を作り直す。';
comment on function public.soil_list_apply_upload(uuid, integer) is '投入履歴を p_limit 件ずつ反映する。新規番号は購入履歴へ 1 行入れてから電話番号台帳へ追加する。';

commit;
