-- リストマスタ：絞り込みの選択肢（列ごとの値と件数）を表に持つ
-- 理由：PostgREST の集計（count()）は本番で無効（PGRST123）。画面は毎回 265 万行を数えず、この表を読む。
-- 投入し直したら soil_list_refresh_options() を呼んで作り直す。実行は Claude（DB 直結）。
begin;

create table if not exists public.soil_list_option (
  column_name text not null,        -- 例：AU光架電可否
  value text not null,              -- ''＝空欄
  row_count integer not null,
  refreshed_at timestamptz not null default now(),
  primary key (column_name, value)
);
alter table public.soil_list_option enable row level security;
revoke all on table public.soil_list_option from public, anon, authenticated;
grant all on table public.soil_list_option to service_role;

create or replace function public.soil_list_refresh_options() returns void language plpgsql as $$
declare c text;
begin
  delete from public.soil_list_option;
  foreach c in array array['住所_都道府県','AU光架電可否','購入状態','アポ禁','判定結果','東西'] loop
    execute format(
      'insert into public.soil_list_option (column_name, value, row_count) select %L, coalesce(%I, ''''), count(*) from public.soil_list_phone group by 1, 2',
      c, c);
  end loop;
end $$;
revoke all on function public.soil_list_refresh_options() from public, anon, authenticated;

select public.soil_list_refresh_options();

comment on table public.soil_list_option is 'リストマスタの絞り込み選択肢（列ごとの値と件数）。soil_list_refresh_options() で作り直す。';
commit;
