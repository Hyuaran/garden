-- リストマスタ：コール履歴の反映（手動ボタン）が 8 秒の制限で止まる問題の修正
-- 原因：画面のボタンは REST 経由で関数を呼ぶため、Supabase の service_role の statement_timeout（8 秒）がかかる。全体反映は 27 秒かかる。
-- 対策：引数なし（画面のボタン）は「前回の反映以降に届いた通話記録がある番号だけ」を対象にする（1 秒未満）。初回の全体反映は 2026-09-07 19:48 に DB 直結で実施済み。
-- 実行は Claude が DB 直結で行う（東海林さんの SQL OK のあと）。冪等。
begin;

create index if not exists idx_system_call_history_imported_at
  on public.system_call_history (imported_at);

create or replace function public.soil_list_refresh_call_summary(p_phones text[] default null)
returns table (phones integer, call_rows integer, synced_through date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since constant date := date '2026-08-01';
  v_from timestamptz;
  v_phones integer := 0;
  v_rows integer := 0;
  v_max date;
begin
  -- 引数なしのときは、前回の反映（1 日の余裕つき）以降に届いた通話記録がある番号だけ
  select s.last_run_at - interval '1 day' into v_from from public.soil_list_call_sync_state s where s.id = 1;

  create temp table t_phones on commit drop as
    select distinct h.phone_number as tel
    from public.system_call_history h
    where h.call_date >= v_since
      and h.phone_number is not null
      and (
        (p_phones is not null and h.phone_number = any (p_phones))
        or (p_phones is null and (v_from is null or h.imported_at >= v_from))
      );

  delete from public.soil_list_call c using t_phones t
  where c."電話番号" = t.tel and c."出所" = 'Garden日次';

  insert into public.soil_list_call ("電話番号", "リスト名", "リスト投入日", "コール回数", "初回コール日", "最終コール日", "最終結果", "旧リスト名", "出所")
  select h.phone_number,
         coalesce(h.list_name, ''),
         null,
         count(*)::integer,
         min(h.call_date),
         max(h.call_date),
         (array_agg(h.result_flag order by h.call_date desc, h.call_time desc nulls last, h.id desc))[1],
         max(h.previous_list_name),
         'Garden日次'
  from public.system_call_history h
  join t_phones t on t.tel = h.phone_number
  where h.call_date >= v_since
  group by h.phone_number, coalesce(h.list_name, '');
  get diagnostics v_rows = row_count;

  update public.soil_list_phone p
  set "コール回数合計" = s.total,
      "最終コール日_集約" = s.last_day
  from (
    select c."電話番号", sum(coalesce(c."コール回数", 0))::integer as total, max(c."最終コール日") as last_day
    from public.soil_list_call c
    join t_phones t on t.tel = c."電話番号"
    group by c."電話番号"
  ) s
  where s."電話番号" = p."電話番号";
  get diagnostics v_phones = row_count;

  select max(h.call_date) into v_max from public.system_call_history h;
  update public.soil_list_call_sync_state
  set synced_through = v_max, last_run_at = now(), last_phones = v_phones, last_rows = v_rows
  where id = 1;

  return query select v_phones, v_rows, v_max;
end;
$$;

revoke all on function public.soil_list_refresh_call_summary(text[]) from public;
grant execute on function public.soil_list_refresh_call_summary(text[]) to service_role;

commit;
