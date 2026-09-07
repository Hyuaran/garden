-- リストマスタ：「住所_都道府県」が空の行を郵便番号から埋め、住所全体が都道府県欄に入っている行を分ける
-- 経緯（2026-09-07）：FileMaker 親の「奈良県」709 件に対し Garden は 319 件。差の 390 件は Garden にも行があるが 住所_都道府県 が空（375）／住所全体が都道府県欄（15）。
--   郵便番号（630〜）はあるので、Garden 内の郵便番号表（system_postal_addresses・22.6 万件）で都道府県・市区町村を埋める。
--   対象：都道府県が空で郵便番号あり 95,367 行のうち郵便番号表で引ける 78,382 行／都道府県欄に住所全体 2,652 行（すべて先頭が都道府県名）。
-- 既に値がある行は触らない。終わったら絞り込みの選択肢（soil_list_option）を作り直す。
-- 実行は Claude が DB 直結で行う（東海林さんの SQL OK のあと）。冪等。
begin;

-- 1) 郵便番号 → 都道府県・市区町村（郵便番号ごとに 1 行に絞る。市区町村は空のときだけ入れる）
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
  and coalesce(p."郵便番号", '') <> ''
  and postal.postal_code = regexp_replace(p."郵便番号", '[^0-9]', '', 'g');

-- 2) 都道府県欄に住所全体が入っている行：先頭の都道府県名だけ残し、残りは市区町村（空のときだけ）へ
update public.soil_list_phone p
set "住所_都道府県" = m.pref,
    "住所_市区町村" = coalesce(nullif(p."住所_市区町村", ''), nullif(substr(p."住所_都道府県", length(m.pref) + 1), ''))
from (
  select "電話番号", (regexp_match("住所_都道府県", '^(北海道|東京都|大阪府|京都府|.{2,3}県)'))[1] as pref
  from public.soil_list_phone
  where length("住所_都道府県") > 5
) m
where m."電話番号" = p."電話番号" and m.pref is not null;

-- 3) 絞り込みの選択肢（件数）を作り直す
select public.soil_list_refresh_options();

analyze public.soil_list_phone;

commit;
