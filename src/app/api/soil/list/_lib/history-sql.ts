export type SoilListHistoryRow = {
  occurred_on: string | null;
  sort_rank: number;
  type: string;
  title: string;
  detail: string;
};

export type SoilListHistoryCurrent = {
  phoneNumber: string;
  mobileNumber: string;
  name: string;
  address: string;
  listName: string;
  lineType: string;
  auCallAvailability: string;
  appointmentBlocked: string;
  internalBlocked: boolean;
  purchaseStatus: string;
  callCount: number;
  lastCallResult: string;
};

// $1＝入力の電話番号、$2＝対象番号の配列（入力＋台帳の電話番号・携帯番号）。配列で絞ると各表の索引が効く（2026-09-15 Claude）
export function buildHistorySql(): string {
  return `
with input_phone as (
  select $1::text as phone
),
ledger as (
  select p.*
  from public.soil_list_phone p, input_phone i
  where p."電話番号" = i.phone or p."携帯番号" = i.phone
  order by case when p."電話番号" = i.phone then 0 else 1 end, p.ctid desc
  limit 1
),
history as (
  select p."購入日" as occurred_on, 20 as sort_rank, '購入' as type,
    coalesce(nullif(p."購入先_NEW", ''), nullif(p."購入先", ''), '購入履歴') as title,
    concat_ws(' ｜ ', nullif(p."開通商材名", ''), case when p."開通日" is not null then '開通日 ' || p."開通日"::text end) as detail
  from public.soil_list_purchase p
  where p."電話番号" = any($2::text[])
  union all
  select a."リスト投入日" as occurred_on, 10 as sort_rank, '投入' as type,
    coalesce(nullif(a."リスト名", ''), '投入履歴') as title,
    concat_ws(' ｜ ', 'アップロード', (select concat_ws('・', nullif(u.file_name, ''), nullif(u.created_by, '')) from public.soil_list_upload u where u.id = a.upload_id), nullif(a."要確認の理由", '')) as detail
  from public.soil_list_assignment a
  where a."電話番号" = any($2::text[])
  union all
  select h.call_date as occurred_on, 30 as sort_rank, 'コール' as type,
    coalesce(nullif(h.result_flag, ''), '（結果なし）') as title,
    concat_ws(' ｜ ', nullif(h.employee_name, ''), nullif(h.list_name, ''), nullif(h.note, '')) as detail
  from public.system_call_history h
  where h.phone_number = any($2::text[])
  union all
  select c."最終コール日" as occurred_on, 31 as sort_rank, 'コール（FM 取込の集約）' as type,
    coalesce(nullif(c."最終結果", ''), '（結果なし）') as title,
    concat_ws(' ｜ ', 'コール回数 ' || coalesce(c."コール回数", 0)::text, nullif(c."リスト名", ''), nullif(c."旧リスト名", '')) as detail
  from public.soil_list_call c
  where c."電話番号" = any($2::text[])
    and c."出所" = 'FM取込'
  union all
  select o."受注日" as occurred_on, 40 as sort_rank, '受注' as type,
    coalesce(nullif(o."商材名区分2", ''), nullif(o."商材名区分1", ''), '受注履歴') as title,
    concat_ws(' ｜ ', nullif(o."チーム名", ''), nullif(o."営業ID", ''), case when o."キャンセル日" is not null then 'キャンセル日 ' || o."キャンセル日"::text end) as detail
  from public.soil_list_order o
  where o."電話番号" = any($2::text[])
  union all
  select nullif(s."修正日", '')::date as occurred_on, 50 as sort_rank, '既契約（新営業）' as type,
    coalesce(nullif(s."既契約情報", ''), '既契約情報') as title,
    concat_ws(' ｜ ', nullif(s."リスト名", ''), nullif(s."営業ID", ''), nullif(s."既契約回線タイプ", '')) as detail
  from public.system_fm_shineigyo s
  where regexp_replace(coalesce(s."電話番号", ''), '\\D', '', 'g') = any($2::text[])
     or regexp_replace(coalesce(s."携帯番号", ''), '\\D', '', 'g') = any($2::text[])
  union all
  select l."住ポン_取得日" as occurred_on, 60 as sort_rank, '住所でポン' as type,
    '取得' as title,
    concat_ws(' ｜ ', nullif(l."住所でポン_年版", ''), nullif(l."氏名_住ポン", ''), nullif(l."住所_住ポン", '')) as detail
  from ledger l
  where l."住ポン_取得日" is not null
  union all
  select b."登録日" as occurred_on, 70 as sort_rank, '自社アポ禁' as type,
    case when b."解除日" is null then '登録' else '登録／解除' end as title,
    concat_ws(' ｜ ', '理由：' || b."理由", '登録者：' || nullif(b."登録者", ''), case when b."解除日" is not null then '解除日：' || b."解除日"::text end, case when b."解除理由" is not null then '解除理由：' || b."解除理由" end) as detail
  from public.soil_list_internal_block b
  where b."電話番号" = any($2::text[])
)
select occurred_on, sort_rank, type, title, detail
from history
order by occurred_on desc nulls last, sort_rank asc
limit 501`;
}

export const CURRENT_HISTORY_SQL = `
select
  "電話番号" as "phoneNumber",
  coalesce("携帯番号", '') as "mobileNumber",
  coalesce("氏名", '') as "name",
  concat(coalesce("住所_都道府県", ''), coalesce("住所_市区町村", ''), coalesce("住所_町名", '')) as "address",
  coalesce("リスト名", '') as "listName",
  coalesce("元回線", '') as "lineType",
  coalesce("AU光架電可否", '') as "auCallAvailability",
  coalesce("アポ禁", '') as "appointmentBlocked",
  coalesce("自社アポ禁", false) as "internalBlocked",
  coalesce("購入状態", '') as "purchaseStatus",
  coalesce("コール回数合計", 0) as "callCount",
  coalesce("最終コール結果", '') as "lastCallResult"
from public.soil_list_phone
where "電話番号" = $1 or "携帯番号" = $1
order by case when "電話番号" = $1 then 0 else 1 end, ctid desc
limit 1`;
