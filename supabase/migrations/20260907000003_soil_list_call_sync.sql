-- リストマスタ：コール履歴を 8 月以降も自動で反映する（Codex-300 用）
-- 元データ：system_call_history（コールセンターの FileMaker から毎日 call-ingest で届く 1 通話 1 行。電話番号・コール日・リスト名・結果）
-- 既存の soil_list_call は FileMaker の書き出し（2026-07-31 まで）。8/1 以降は system_call_history から 電話番号×リスト名 で集約した行を「Garden日次」として持つ。
-- 実行は Claude が DB 直結で行う（東海林さんの SQL OK のあと）。冪等。
begin;

-- 1) 行の出所を区別する列（FM取込＝7/31 までの書き出し／Garden日次＝system_call_history からの集約）
alter table public.soil_list_call
  add column if not exists "出所" text not null default 'FM取込';
create index if not exists soil_list_call_tel_src_idx on public.soil_list_call ("電話番号", "出所");
comment on column public.soil_list_call."出所" is 'FM取込＝FileMaker 書き出し（2026-07-31 まで）／Garden日次＝system_call_history から 8/1 以降を集約';

-- 2) 反映状態（画面に「コール履歴は M/D まで反映」と出すため）
create table if not exists public.soil_list_call_sync_state (
  id smallint primary key default 1 check (id = 1),
  synced_through date,               -- system_call_history の最終コール日
  last_run_at timestamptz,
  last_phones integer,
  last_rows integer
);
insert into public.soil_list_call_sync_state (id) values (1) on conflict (id) do nothing;
alter table public.soil_list_call_sync_state enable row level security;
drop policy if exists soil_list_call_sync_state_select on public.soil_list_call_sync_state;
create policy soil_list_call_sync_state_select on public.soil_list_call_sync_state
  for select to authenticated using (true);

-- 3) 反映の本体。p_phones を渡せばその番号だけ（call-ingest の各バッチ後）、null なら 8/1 以降に履歴のある番号すべて（画面のボタン・初回）
create or replace function public.soil_list_refresh_call_summary(p_phones text[] default null)
returns table (phones integer, call_rows integer, synced_through date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_since constant date := date '2026-08-01';
  v_phones integer := 0;
  v_rows integer := 0;
  v_max date;
begin
  create temp table t_phones on commit drop as
    select distinct h.phone_number as tel
    from public.system_call_history h
    where h.call_date >= v_since
      and h.phone_number is not null
      and (p_phones is null or h.phone_number = any (p_phones));

  -- Garden日次 の行を作り直す（8/1 以降を 電話番号×リスト名 で集約）
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

  -- 親（電話番号台帳）の集約列を更新（FM取込 ＋ Garden日次 の合計）
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
comment on function public.soil_list_refresh_call_summary(text[]) is 'リストマスタのコール履歴反映。system_call_history（8/1 以降）を soil_list_call（出所=Garden日次）に集約し、soil_list_phone の コール回数合計・最終コール日_集約 を更新する。';

commit;
