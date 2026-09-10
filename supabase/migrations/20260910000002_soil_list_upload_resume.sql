-- リストマスタ：アップロード反映を 8 秒制限に収まるよう分割し、途中停止から再開できるようにする
-- migration は書くだけ。実行は別担当で行う。
begin;

alter table public.soil_list_assignment
  add column if not exists applied_at timestamptz;

create index if not exists soil_list_assignment_upload_pending_idx
  on public.soil_list_assignment (upload_id)
  where applied_at is null;

alter table public.soil_list_upload
  add column if not exists status text;

update public.soil_list_upload
set status = case when result is not null then 'done' else 'processing' end
where status is null;

alter table public.soil_list_upload
  alter column status set default 'processing',
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'soil_list_upload_status_check'
      and conrelid = 'public.soil_list_upload'::regclass
  ) then
    alter table public.soil_list_upload
      add constraint soil_list_upload_status_check
      check (status in ('processing', 'done', 'failed'));
  end if;
end;
$$;

drop function if exists public.soil_list_apply_upload(uuid);

create or replace function public.soil_list_apply_upload(p_upload_id uuid, p_limit integer default 1000)
returns table (
  assignments integer,
  assignments_new integer,
  assignments_updated integer,
  parent_updated integer,
  parent_inserted integer,
  parent_kept integer,
  skipped integer,
  remaining integer
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
  v_upload_created_at timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit, 1000), 1000));
  v_applied_at timestamptz := now();
begin
  select u.created_at into v_upload_created_at
  from public.soil_list_upload u
  where u.id = p_upload_id;

  create temp table soil_list_upload_batch on commit drop as
    select a.*
    from public.soil_list_assignment a
    where a.upload_id = p_upload_id
      and a.applied_at is null
    order by a."リスト投入日" asc nulls last, a.updated_at asc, a."電話番号" asc, a."リスト名" asc
    limit v_limit;

  select count(*)::integer into v_assignments
  from soil_list_upload_batch;

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
    "データ出所"
  )
  select
    t."電話番号",
    t.last_name,
    t.first_name,
    nullif(concat_ws(' ', t.last_name, t.first_name), ''),
    t.birthday,
    t.postal_code,
    t.prefecture,
    t.city,
    t.town,
    t.block,
    t.mobile_number,
    t."リスト名",
    t."リスト投入日",
    'Garden投入'
  from soil_list_upload_target t
  where not exists (
    select 1 from public.soil_list_phone p where p."電話番号" = t."電話番号"
  );
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
    v_remaining;
end;
$$;

revoke all on function public.soil_list_apply_upload(uuid, integer) from public, anon, authenticated;
grant execute on function public.soil_list_apply_upload(uuid, integer) to service_role;

comment on column public.soil_list_assignment.applied_at is 'アップロード反映で親の電話番号台帳への処理を終えた時刻。要確認で親を触らない行にも付ける。';
comment on column public.soil_list_upload.status is 'アップロード反映の状態。processing=処理中、done=完了、failed=途中停止。';
comment on function public.soil_list_apply_upload(uuid, integer) is '投入履歴を p_limit 件ずつ親の電話番号台帳へ反映する。要確認の行は親を触らず applied_at を付け、remaining に未処理件数を返す。';

commit;
