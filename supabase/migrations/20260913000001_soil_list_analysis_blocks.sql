begin;

create table if not exists public.soil_list_analysis_cell (
  block text not null check (block in ('vendor', 'active_list', 'contract')),
  segment text not null,
  result text not null,
  list_name text not null,
  list_loaded_on date,
  row_count integer not null default 0,
  called_count integer not null default 0,
  call_total integer not null default 0,
  invalid_count integer not null default 0,
  order_count integer not null default 0,
  acquired_count integer not null default 0,
  last_called_on date,
  segment_last_called_on date,
  primary key (block, segment, result, list_name)
);

create table if not exists public.soil_list_analysis_cell_next (like public.soil_list_analysis_cell including all);

create index if not exists soil_list_analysis_cell_block_segment_idx
  on public.soil_list_analysis_cell (block, segment);

create index if not exists soil_list_analysis_cell_next_block_segment_idx
  on public.soil_list_analysis_cell_next (block, segment);

create table if not exists public.soil_list_analysis_state (
  id integer primary key default 1 check (id = 1),
  refreshed_at timestamptz,
  last_elapsed_ms integer not null default 0,
  last_error text,
  rows integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.soil_list_analysis_state (id)
values (1)
on conflict (id) do nothing;

alter table public.soil_list_analysis_cell enable row level security;
alter table public.soil_list_analysis_cell_next enable row level security;
alter table public.soil_list_analysis_state enable row level security;

drop policy if exists soil_list_analysis_state_select_authenticated on public.soil_list_analysis_state;
create policy soil_list_analysis_state_select_authenticated
  on public.soil_list_analysis_state
  for select
  to authenticated
  using (true);

-- 直近 30 日にコールがあったリスト名（②の区切り）。begin() で全体から 1 回だけ作る
-- （分割ごとに作ると、その分割にたまたま最近のコールが無いリストが落ちて数が合わなくなる）
create table if not exists public.soil_list_analysis_active_list (
  list_name text primary key,
  segment_last_called_on date not null
);
alter table public.soil_list_analysis_active_list enable row level security;

create or replace function public.soil_list_normalize_call_result(p_value text)
returns text
language sql
immutable
as $$
  select nullif(
    replace(
      translate(
        btrim(coalesce(p_value, '')),
        '０１２３４５６７８９ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      ),
      '坦不',
      '担不'
    ),
    ''
  );
$$;

create or replace function public.soil_list_analysis_begin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.soil_list_analysis_cell_next;
  -- ②「今コールしているリスト」の区切り＝直近 30 日にコールがあったリスト名。全体から 1 回で作る（最終コール日_集約 の索引で 1 秒台）
  truncate table public.soil_list_analysis_active_list;
  insert into public.soil_list_analysis_active_list (list_name, segment_last_called_on)
  select coalesce(nullif(p."リスト名", ''), '（リスト名なし）'), max(p."最終コール日_集約")
  from public.soil_list_phone p
  where p."最終コール日_集約" >= current_date - interval '30 days'
  group by 1;
  update public.soil_list_analysis_state
  set last_error = null,
      updated_at = now()
  where id = 1;
end;
$$;

create or replace function public.soil_list_analysis_collect(p_chunk integer, p_chunks integer default 100)
returns table (rows integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
  v_pages bigint;
  v_lo bigint;
  v_hi bigint;
  v_lo_tid tid;
  v_hi_tid tid;
begin
  -- 分割は電話番号の先頭桁ではなく、表の物理的な位置（ページ番号）で p_chunks 等分する。
  -- 先頭 2 桁だと日本の番号は全部 0 始まりで実質 10 分割にしかならず、1 回 12 秒（8 秒超）だった。
  -- ページの範囲なら順に読むだけなので 1 回 0.1 秒（2026-09-13 本番で実測。129,286 ページ／100 分割）。
  if p_chunks is null or p_chunks < 1 or p_chunk is null or p_chunk < 0 or p_chunk >= p_chunks then
    raise exception 'p_chunk must be between 0 and p_chunks - 1';
  end if;

  select pg_relation_size('public.soil_list_phone') / current_setting('block_size')::bigint + 1 into v_pages;
  v_lo := (v_pages * p_chunk) / p_chunks;
  v_hi := (v_pages * (p_chunk + 1)) / p_chunks;
  v_lo_tid := ('(' || v_lo || ',0)')::tid;
  -- 最後の分割は上限を付けない（集計中に表が伸びても取りこぼさない）
  v_hi_tid := case when p_chunk = p_chunks - 1 then null else ('(' || v_hi || ',0)')::tid end;

  insert into public.soil_list_analysis_cell_next (
    block, segment, result, list_name, list_loaded_on,
    row_count, called_count, call_total, invalid_count, order_count, acquired_count,
    last_called_on, segment_last_called_on
  )
  select
    x.block,
    x.segment,
    x.result,
    x.list_name,
    max(x.list_loaded_on) as list_loaded_on,
    count(*)::integer as row_count,
    count(*) filter (where x.call_total > 0)::integer as called_count,
    sum(x.call_total)::integer as call_total,
    count(*) filter (where x.result = '無効')::integer as invalid_count,
    count(*) filter (where x.order_count > 0)::integer as order_count,
    count(*) filter (where x.result = '獲得')::integer as acquired_count,
    max(x.last_called_on) as last_called_on,
    max(x.segment_last_called_on) as segment_last_called_on
  from (
    select
      'vendor'::text as block,
      coalesce(nullif(p."最新購入先", ''), '（購入先なし）') as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      p."最終コール日_集約" as last_called_on,
      null::date as segment_last_called_on
    from public.soil_list_phone p
    where p.ctid >= v_lo_tid and (v_hi_tid is null or p.ctid < v_hi_tid)
      and p."電話番号" is not null and p."電話番号" <> ''

    union all

    select
      'active_list'::text as block,
      s.list_name as segment,
      case
        when coalesce(p."コール回数合計", 0) = 0 then '未コール'
        else coalesce(public.soil_list_normalize_call_result(p."最終コール結果"), '（結果なし）')
      end as result,
      coalesce(nullif(p."リスト名", ''), '（リスト名なし）') as list_name,
      p."リスト投入日" as list_loaded_on,
      coalesce(p."コール回数合計", 0) as call_total,
      coalesce(p."受注件数", 0) as order_count,
      p."最終コール日_集約" as last_called_on,
      s.segment_last_called_on
    from public.soil_list_phone p
    join public.soil_list_analysis_active_list s
      on s.list_name = coalesce(nullif(p."リスト名", ''), '（リスト名なし）')
    where p.ctid >= v_lo_tid and (v_hi_tid is null or p.ctid < v_hi_tid)
      and p."電話番号" is not null and p."電話番号" <> ''
  ) x
  group by x.block, x.segment, x.result, x.list_name
  on conflict (block, segment, result, list_name) do update set
    list_loaded_on = greatest(public.soil_list_analysis_cell_next.list_loaded_on, excluded.list_loaded_on),
    row_count = public.soil_list_analysis_cell_next.row_count + excluded.row_count,
    called_count = public.soil_list_analysis_cell_next.called_count + excluded.called_count,
    call_total = public.soil_list_analysis_cell_next.call_total + excluded.call_total,
    invalid_count = public.soil_list_analysis_cell_next.invalid_count + excluded.invalid_count,
    order_count = public.soil_list_analysis_cell_next.order_count + excluded.order_count,
    acquired_count = public.soil_list_analysis_cell_next.acquired_count + excluded.acquired_count,
    last_called_on = greatest(public.soil_list_analysis_cell_next.last_called_on, excluded.last_called_on),
    segment_last_called_on = greatest(public.soil_list_analysis_cell_next.segment_last_called_on, excluded.segment_last_called_on);

  get diagnostics v_rows = row_count;
  return query select v_rows;
end;
$$;

create or replace function public.soil_list_analysis_finish(p_started_at timestamptz default null)
returns table (refreshed_at timestamptz, rows integer, elapsed_ms integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refreshed_at timestamptz := now();
  v_rows integer;
  v_elapsed_ms integer;
begin
  truncate table public.soil_list_analysis_cell;
  insert into public.soil_list_analysis_cell select * from public.soil_list_analysis_cell_next;
  get diagnostics v_rows = row_count;

  v_elapsed_ms := case
    when p_started_at is null then 0
    else floor(extract(epoch from (clock_timestamp() - p_started_at)) * 1000)::integer
  end;

  update public.soil_list_analysis_state
  set refreshed_at = v_refreshed_at,
      last_elapsed_ms = v_elapsed_ms,
      last_error = null,
      rows = v_rows,
      updated_at = v_refreshed_at
  where id = 1;

  return query select v_refreshed_at, v_rows, v_elapsed_ms;
end;
$$;

create or replace function public.soil_list_analysis_fail(p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.soil_list_analysis_state
  set last_error = left(coalesce(p_error, 'analysis_refresh_failed'), 1000),
      updated_at = now()
  where id = 1;
$$;

revoke all on table public.soil_list_analysis_cell from public, anon, authenticated;
revoke all on table public.soil_list_analysis_cell_next from public, anon, authenticated;
revoke all on table public.soil_list_analysis_state from public, anon, authenticated;
revoke all on table public.soil_list_analysis_active_list from public, anon, authenticated;
grant all on table public.soil_list_analysis_active_list to service_role;
grant all on table public.soil_list_analysis_cell to service_role;
grant all on table public.soil_list_analysis_cell_next to service_role;
grant all on table public.soil_list_analysis_state to service_role;
grant select on table public.soil_list_analysis_state to authenticated;

revoke all on function public.soil_list_normalize_call_result(text) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_begin() from public, anon, authenticated;
revoke all on function public.soil_list_analysis_collect(integer, integer) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_finish(timestamptz) from public, anon, authenticated;
revoke all on function public.soil_list_analysis_fail(text) from public, anon, authenticated;
grant execute on function public.soil_list_normalize_call_result(text) to service_role;
grant execute on function public.soil_list_analysis_begin() to service_role;
grant execute on function public.soil_list_analysis_collect(integer, integer) to service_role;
grant execute on function public.soil_list_analysis_finish(timestamptz) to service_role;
grant execute on function public.soil_list_analysis_fail(text) to service_role;

comment on table public.soil_list_analysis_cell is 'リストマスタ分析タブ用の集計セル。電話番号が空の行は数えない。';
comment on table public.soil_list_analysis_cell_next is 'リストマスタ分析タブ用の作業集計セル。finish まで本体には反映しない。';
comment on table public.soil_list_analysis_state is 'リストマスタ分析タブの集計状態。画面の集計時点に使う。';
comment on function public.soil_list_analysis_collect(integer, integer) is '電話番号台帳を物理的な位置で p_chunks 等分し、p_chunk 番目の分だけ分析セルに足し込む。1 回 0.1 秒（2026-09-13 実測）。電話番号が空の行は数えない。';

commit;
