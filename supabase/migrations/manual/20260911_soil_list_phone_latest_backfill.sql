-- リストマスタ：電話番号台帳の最新列を電話番号範囲ごとに少しずつ埋める手動 SQL
-- migration には入れない。Claude が DB 直結で、範囲を小さく区切って実行する。
-- 例：p_from/p_to を 0000000000-0009999999 のように分け、1 回で全件 update しない。

begin;

create temp table soil_list_phone_latest_backfill_target on commit drop as
  select p."電話番号"
  from public.soil_list_phone p
  where p."電話番号" >= :'p_from'
    and p."電話番号" < :'p_to'
  order by p."電話番号"
  limit coalesce(nullif(:'p_limit', '')::integer, 10000);

select *
from public.soil_list_refresh_phone_latest(
  array(select "電話番号" from soil_list_phone_latest_backfill_target)
);

commit;
