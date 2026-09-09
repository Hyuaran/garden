-- リストマスタ：取込ファイルの投入履歴を Garden に残し、親の電話番号台帳へ最新のリスト名・投入日を反映する
-- 規則：
-- ・投入履歴は 電話番号×リスト名 で 1 行。取込ファイルの 19 列をそのまま残す。
-- ・リスト投入日はリスト名の中の _YYYYMMDD から作った日付を使う。
-- ・親は同じ電話番号の行を増やさず、リスト名・リスト投入日だけ最新投入で上書きする。
-- ・氏名・住所・郵便番号・携帯番号は親が空欄のときだけ埋める。AU光架電可否・アポ禁・購入状態などの判定は変えない。
-- ・要確認の行は投入履歴に残し、親は触らない。
begin;

create table if not exists public.soil_list_upload (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  format text not null check (format in ('A', 'B', 'C')),
  row_count integer not null,
  list_names jsonb not null default '{}'::jsonb,
  result jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.soil_list_assignment (
  "電話番号" text not null,
  "リスト名" text not null,
  "リスト投入日" date,
  "形式" text not null check ("形式" in ('A', 'B', 'C')),
  "電話番号_ハイフンなし" text,
  "携帯番号_ハイフンなし" text,
  "携帯キャリア" text,
  "申込者名_姓" text,
  "申込者名_名" text,
  "申込者名_生年月日" text,
  "連絡担当者名_姓" text,
  "連絡担当者名_名" text,
  "連絡担当者名_生年月日" text,
  "既契約者名_姓" text,
  "既契約者名_名" text,
  "既契約者名_生年月日" text,
  "設置先_郵便番号" text,
  "設置先_住所_都道府県" text,
  "設置先_住所_市町村" text,
  "設置先_住所_町域" text,
  "設置先_住所_建物名" text,
  "設置先_住所_部屋番号" text,
  upload_id uuid references public.soil_list_upload(id),
  "要確認の理由" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key ("電話番号", "リスト名")
);

create index if not exists soil_list_assignment_phone_idx on public.soil_list_assignment ("電話番号");
create index if not exists soil_list_assignment_list_name_idx on public.soil_list_assignment ("リスト名");
create index if not exists soil_list_assignment_upload_id_idx on public.soil_list_assignment (upload_id);
create index if not exists soil_list_upload_created_at_idx on public.soil_list_upload (created_at desc);

alter table public.soil_list_upload enable row level security;
alter table public.soil_list_assignment enable row level security;
revoke all on table public.soil_list_upload, public.soil_list_assignment from public, anon, authenticated;
grant all on table public.soil_list_upload, public.soil_list_assignment to service_role;

create or replace function public.soil_list_apply_upload(p_upload_id uuid)
returns table (
  assignments integer,
  assignments_new integer,
  assignments_updated integer,
  parent_updated integer,
  parent_inserted integer,
  parent_kept integer,
  skipped integer
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
  v_upload_created_at timestamptz;
begin
  select u.created_at into v_upload_created_at
  from public.soil_list_upload u
  where u.id = p_upload_id;

  select count(*)::integer into v_assignments
  from public.soil_list_assignment a
  where a.upload_id = p_upload_id;

  select count(*)::integer into v_assignments_new
  from public.soil_list_assignment a
  where a.upload_id = p_upload_id
    and v_upload_created_at is not null
    and a.created_at >= v_upload_created_at;
  v_assignments_updated := greatest(v_assignments - v_assignments_new, 0);

  select count(*)::integer into v_skipped
  from public.soil_list_assignment a
  where a.upload_id = p_upload_id
    and a."要確認の理由" is not null;

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
    from public.soil_list_assignment a
    where a.upload_id = p_upload_id
      and a."要確認の理由" is null
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

  return query select
    v_assignments,
    v_assignments_new,
    v_assignments_updated,
    v_parent_updated,
    v_parent_inserted,
    v_parent_kept,
    v_skipped;
end;
$$;

create or replace function public.soil_list_analysis_by_list()
returns table (
  list_name text,
  list_loaded_on date,
  row_count integer,
  called_count integer,
  purchase_history_count integer,
  last_called_on date
)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
    max(p."リスト投入日") as list_loaded_on,
    count(*)::integer as row_count,
    count(*) filter (where coalesce(p."コール回数合計", 0) > 0)::integer as called_count,
    count(*) filter (where p."購入履歴あり" is true)::integer as purchase_history_count,
    max(p."最終コール日_集約") as last_called_on
  from public.soil_list_phone p
  group by coalesce(nullif(p."リスト名", ''), '（リスト名なし）')
  order by max(p."リスト投入日") desc nulls last
  limit 500;
$$;

revoke all on function public.soil_list_apply_upload(uuid) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_by_list() from public, anon, authenticated;
grant execute on function public.soil_list_apply_upload(uuid) to service_role;
grant execute on function public.soil_list_analysis_by_list() to service_role;

comment on table public.soil_list_upload is 'リストマスタのアップロード記録。誰が・いつ・何行取り込んだかと結果を残す。';
comment on table public.soil_list_assignment is 'リストマスタの投入履歴。電話番号×リスト名で取込ファイルの値をそのまま残す。';
comment on function public.soil_list_apply_upload(uuid) is '投入履歴を親の電話番号台帳へ反映する。要確認の行は親を触らず、既存の氏名・住所などは空欄のときだけ埋める。';
comment on function public.soil_list_analysis_by_list() is 'リスト名ごとの件数、架電済み、購入履歴あり、最終コール日を親の集約列だけで出す。';

commit;
