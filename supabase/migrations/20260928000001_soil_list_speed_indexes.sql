-- 本番は Claude が create index concurrently で作成済み。トランザクションの外で流すこと。

create index concurrently if not exists soil_list_phone_default_cover_idx
on public.soil_list_phone ("住所_都道府県")
include ("最新購入先", "元回線", "契約時期", "コール回数合計", "最終コール日_集約", "購入状態", "区分")
where "AU光架電可否" = '○'
  and ("アポ禁" is null or "アポ禁" = '')
  and "自社アポ禁" = false;

create index concurrently if not exists soil_list_phone_last_call_desc_idx
on public.soil_list_phone ("最終コール日_集約" desc nulls last, "電話番号");
