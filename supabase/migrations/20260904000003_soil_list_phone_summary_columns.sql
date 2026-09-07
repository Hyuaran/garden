-- リストマスタ：親（電話番号台帳）に子表の要約列を足す（Codex-291b 用）
-- 目的：絞り込みを親 1 表だけで済ませる（子表を先に絞る方式は PostgREST の 1,000 行上限で件数が 0 になる不具合があった）
-- 実行は DB 直結（psycopg・時間制限なし）で Claude が行う。SQL Editor だと 265 万行の更新で時間切れになる恐れがある。
begin;

alter table public.soil_list_phone
  add column if not exists "コール回数合計" integer,
  add column if not exists "最終コール日_集約" date,
  add column if not exists "購入履歴あり" boolean not null default false;

-- コール履歴（電話番号ごとに複数行あり）→ 合計回数と最終日
update public.soil_list_phone p
set "コール回数合計" = c.total, "最終コール日_集約" = c.last_day
from (
  select "電話番号", sum(coalesce("コール回数", 0))::integer as total, max("最終コール日") as last_day
  from public.soil_list_call group by "電話番号"
) c
where c."電話番号" = p."電話番号";

-- コール履歴が無い番号（未コール）は 0 にする。空のままだと「コール回数 3 以下」の絞り込みから未コールが外れる（2026-09-07 東海林さん OK・実行済み）
update public.soil_list_phone set "コール回数合計" = 0 where "コール回数合計" is null;
alter table public.soil_list_phone alter column "コール回数合計" set default 0;

-- 購入履歴の有無
update public.soil_list_phone p
set "購入履歴あり" = true
where exists (select 1 from public.soil_list_purchase s where s."電話番号" = p."電話番号");

create index if not exists soil_list_phone_call_total_idx on public.soil_list_phone ("コール回数合計");
create index if not exists soil_list_phone_last_call_idx on public.soil_list_phone ("最終コール日_集約");
create index if not exists soil_list_phone_purchased_idx on public.soil_list_phone ("購入履歴あり");
analyze public.soil_list_phone;

comment on column public.soil_list_phone."コール回数合計" is 'コール履歴の合計回数（集約）。投入し直したら 20260904000003 の update を再実行する。';
comment on column public.soil_list_phone."最終コール日_集約" is 'コール履歴の最終コール日の最大（集約）。';
comment on column public.soil_list_phone."購入履歴あり" is '購入履歴に 1 行でもあれば true（集約）。';

commit;
