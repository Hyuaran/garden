-- リストマスタ分析②「今コールしているリスト」の決め方を直す（東海林さん 2026-09-13）
-- 今まで：直近 30 日に 1 件でもコールがあったリスト名（リスト名が空の 128 万件が 1 つのリスト扱いで入り、
--         2025 年投入の古いリストも数十件のコールで丸ごと入っていたため、未コールが 140 万件に見えた）
-- これから：リスト名があり、投入日が直近 60 日以内で、直近 30 日にコールがあるリスト
-- 実行は Claude が DB 直結で行う（東海林さんの了承のあと）。冪等。
begin;

create or replace function public.soil_list_analysis_begin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.soil_list_analysis_cell_next;
  truncate table public.soil_list_analysis_active_list;
  insert into public.soil_list_analysis_active_list (list_name, segment_last_called_on)
  select p."リスト名", max(p."最終コール日_集約")
  from public.soil_list_phone p
  where p."最終コール日_集約" >= current_date - interval '30 days'
    and coalesce(p."リスト名", '') <> ''
  group by p."リスト名"
  having max(p."リスト投入日") >= current_date - interval '60 days';
  update public.soil_list_analysis_state
  set last_error = null,
      updated_at = now()
  where id = 1;
end;
$$;

comment on table public.soil_list_analysis_active_list is '分析②の区切り。リスト名があり、投入日が直近 60 日以内で、直近 30 日にコールがあるリスト名（begin() で作り直す）。';

commit;
