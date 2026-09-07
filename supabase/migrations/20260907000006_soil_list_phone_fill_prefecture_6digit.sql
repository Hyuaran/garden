-- リストマスタ：郵便番号が 6 桁（先頭の 0 が落ちている＝北海道・青森・岩手・秋田）の行の都道府県を埋める
-- 経緯（2026-09-07）：20260907000005 のあとも都道府県が空で郵便番号ありの行が 17,000 行ほど残る。うち 6 桁は 1,314 行で、先頭に 0 を足すと 758 行が郵便番号表で引ける（北海道 750・岩手 4・青森 3・秋田 1）。
-- 既に値がある行は触らない。終わったら絞り込みの選択肢を作り直す。実行は Claude が DB 直結で行う（東海林さんの SQL OK のあと）。冪等。
begin;

with postal as (
  select distinct on (postal_code) postal_code, prefecture, city
  from public.system_postal_addresses
  order by postal_code, is_special desc, town
)
update public.soil_list_phone p
set "住所_都道府県" = postal.prefecture,
    "住所_市区町村" = coalesce(nullif(p."住所_市区町村", ''), postal.city)
from postal
where coalesce(p."住所_都道府県", '') = ''
  and length(regexp_replace(p."郵便番号", '[^0-9]', '', 'g')) = 6
  and postal.postal_code = '0' || regexp_replace(p."郵便番号", '[^0-9]', '', 'g');

select public.soil_list_refresh_options();
analyze public.soil_list_phone;

commit;
