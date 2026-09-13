-- リストマスタ分析③「新営業 FileMaker の既契約」を集計に足す。
-- 実行は Claude が DB 直結で行う。Codex はこの migration を書くだけ。
begin;

create table if not exists public.soil_list_analysis_contract_phone (
  "電話番号" text primary key,
  "既契約情報" text not null
);

create index if not exists soil_list_analysis_contract_phone_contract_idx
  on public.soil_list_analysis_contract_phone ("既契約情報");

alter table public.soil_list_analysis_contract_phone enable row level security;

drop policy if exists soil_list_analysis_contract_phone_service_role_all on public.soil_list_analysis_contract_phone;
create policy soil_list_analysis_contract_phone_service_role_all
  on public.soil_list_analysis_contract_phone
  for all
  to service_role
  using (true)
  with check (true);

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

  truncate table public.soil_list_analysis_contract_phone;
  insert into public.soil_list_analysis_contract_phone ("電話番号", "既契約情報")
  select phone, contract
  from (
    select
      regexp_replace(
        translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'),
        '[^0-9]',
        '',
        'g'
      ) as phone,
      coalesce(s."既契約情報", '') as contract,
      row_number() over (
        partition by regexp_replace(
          translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'),
          '[^0-9]',
          '',
          'g'
        )
        order by
          nullif(s."修正日", '') desc nulls last,
          case when s."主キー" ~ '^[0-9]+$' then s."主キー"::numeric else null end desc nulls last
      ) as rn
    from public.system_fm_shineigyo s
    where regexp_replace(
      translate(coalesce(s."電話番号", ''), '０１２３４５６７８９', '0123456789'),
      '[^0-9]',
      '',
      'g'
    ) <> ''
  ) ranked
  where rn = 1;

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
  if p_chunks is null or p_chunks < 1 or p_chunk is null or p_chunk < 0 or p_chunk >= p_chunks then
    raise exception 'p_chunk must be between 0 and p_chunks - 1';
  end if;

  select pg_relation_size('public.soil_list_phone') / current_setting('block_size')::bigint + 1 into v_pages;
  v_lo := (v_pages * p_chunk) / p_chunks;
  v_hi := (v_pages * (p_chunk + 1)) / p_chunks;
  v_lo_tid := ('(' || v_lo || ',0)')::tid;
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

    union all

    select
      'contract'::text as block,
      coalesce(nullif(c."既契約情報", ''), '（既契約情報なし）') as segment,
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
    join public.soil_list_analysis_contract_phone c
      on c."電話番号" = p."電話番号"
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

revoke all on table public.soil_list_analysis_contract_phone from public, anon, authenticated;
grant all on table public.soil_list_analysis_contract_phone to service_role;

comment on table public.soil_list_analysis_contract_phone is '分析③用。FileMaker「新営業」の電話番号ごとの最新の既契約情報（begin() で作り直す）。';
comment on function public.soil_list_analysis_begin() is '分析集計の作業表を初期化し、②の区切りと③の新営業既契約情報を作り直す。';
comment on function public.soil_list_analysis_collect(integer, integer) is '電話番号台帳を物理的な位置で p_chunks 等分し、p_chunk 番目の分だけ分析セルに足し込む。③ contract も同時に集計する。電話番号が空の行は数えない。';

commit;
