create or replace function public.soil_list_refresh_options() returns void language plpgsql as $$
declare c text;
begin
  delete from public.soil_list_option;
  foreach c in array array['住所_都道府県','AU光架電可否','購入状態','最新購入先','アポ禁','判定結果','東西','元回線','区分'] loop
    execute format(
      'insert into public.soil_list_option (column_name, value, row_count) select %L, coalesce(%I, ''''), count(*) from public.soil_list_phone group by 1, 2',
      c, c);
  end loop;
end $$;

create index if not exists soil_list_phone_latest_purchase_vendor_idx
  on public.soil_list_phone ("最新購入先");
