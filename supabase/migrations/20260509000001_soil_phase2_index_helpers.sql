-- ============================================================
-- Garden Soil — Phase 2 (FileMaker CSV 200 万件取込) INDEX OFF/ON ヘルパー
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §6
-- 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
--
-- 目的:
--   Phase 2 で 200 万件 CSV を soil_lists に bulk INSERT する際、
--   非 UNIQUE INDEX を一時 DROP して取込時間を 5-10x 短縮する。
--   完了後、CREATE INDEX CONCURRENTLY で再構築（読込ブロックなし）。
--
-- 構成:
--   1. soil_phase2_drop_bulk_load_indexes() — 非 UNIQUE INDEX を一括 DROP（admin only）
--   2. soil_phase2_count_bulk_load_indexes() — 現在の INDEX 状況を返す（観測用）
--
-- CREATE INDEX CONCURRENTLY は本 migration では実行しない:
--   PostgreSQL の CONCURRENTLY は transaction block 外でしか実行できないため、
--   PL/pgSQL 関数 / migration 内では呼び出せない。
--   完了後の INDEX 再構築は scripts/soil-phase2-recreate-indexes.sql を
--   Supabase Dashboard SQL Editor で手動実行する運用とする。
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイル内容を Run（関数を登録）。
--   garden-prod 適用は東海林さん別途承認後（CLAUDE.md ルール）。
--
-- 冪等性:
--   `create or replace function` で再実行可能。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 非 UNIQUE INDEX 一括 DROP 関数
-- ------------------------------------------------------------
-- 落とす対象（取込中は再構築せず、完了後 CONCURRENTLY で再作成）:
--   - idx_soil_lists_phone_primary（000001）
--   - idx_soil_lists_name_kanji（000001）
--   - idx_soil_lists_status（000001）
--   - idx_soil_lists_primary_case（000001）
--   - idx_soil_lists_pd_number（000001）
--   - idx_soil_lists_is_outside_list（000001）
--   - idx_soil_lists_merged_into_id（000001）
--   - idx_soil_lists_industry_pref（000005）
--   - idx_soil_lists_active_records（000005）
--   - idx_soil_lists_list_no（000005）
--   - idx_soil_lists_name_trgm（000005、GIN trigram、重い）
--   - idx_soil_lists_address_trgm（000005、GIN trigram、重い）
--
-- 維持する UNIQUE INDEX（重複防止のため drop しない）:
--   - uq_soil_lists_supply_point_22
--   - idx_soil_lists_source（partial unique）

create or replace function public.soil_phase2_drop_bulk_load_indexes()
returns table(dropped_index text, sql_executed text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_indexes text[] := array[
    'idx_soil_lists_phone_primary',
    'idx_soil_lists_name_kanji',
    'idx_soil_lists_status',
    'idx_soil_lists_primary_case',
    'idx_soil_lists_pd_number',
    'idx_soil_lists_is_outside_list',
    'idx_soil_lists_merged_into_id',
    'idx_soil_lists_industry_pref',
    'idx_soil_lists_active_records',
    'idx_soil_lists_list_no',
    'idx_soil_lists_name_trgm',
    'idx_soil_lists_address_trgm'
  ];
  v_idx text;
  v_sql text;
begin
  -- admin / super_admin のみ呼出許可（呼出側で role チェック想定、関数 SECURITY DEFINER の二重保険）
  if not exists (
    select 1 from public.root_user_roles
    where user_id = auth.uid()
      and role in ('admin', 'super_admin')
  ) then
    raise exception 'soil_phase2_drop_bulk_load_indexes: requires admin / super_admin role';
  end if;

  foreach v_idx in array v_indexes loop
    v_sql := format('drop index if exists public.%I', v_idx);
    execute v_sql;
    dropped_index := v_idx;
    sql_executed := v_sql;
    return next;
  end loop;
end;
$$;

comment on function public.soil_phase2_drop_bulk_load_indexes() is
  'Phase 2 (FileMaker CSV 200 万件取込) 開始前に非 UNIQUE INDEX を一括 DROP する admin 関数。'
  '完了後は scripts/soil-phase2-recreate-indexes.sql を SQL Editor で手動実行して INDEX 再構築。';

-- ------------------------------------------------------------
-- 2. 現状観測関数（取込前後で件数比較に使う）
-- ------------------------------------------------------------

create or replace function public.soil_phase2_count_bulk_load_indexes()
returns table(index_name text, exists boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_indexes text[] := array[
    'idx_soil_lists_phone_primary',
    'idx_soil_lists_name_kanji',
    'idx_soil_lists_status',
    'idx_soil_lists_primary_case',
    'idx_soil_lists_pd_number',
    'idx_soil_lists_is_outside_list',
    'idx_soil_lists_merged_into_id',
    'idx_soil_lists_industry_pref',
    'idx_soil_lists_active_records',
    'idx_soil_lists_list_no',
    'idx_soil_lists_name_trgm',
    'idx_soil_lists_address_trgm'
  ];
  v_idx text;
begin
  foreach v_idx in array v_indexes loop
    index_name := v_idx;
    exists := pg_catalog.to_regclass(format('public.%I', v_idx)) is not null;
    return next;
  end loop;
end;
$$;

comment on function public.soil_phase2_count_bulk_load_indexes() is
  'Phase 2 取込前後の INDEX 状況を確認する観測用関数。drop 漏れ / 再作成漏れの検出に使う。';

-- ------------------------------------------------------------
-- 3. 権限付与
-- ------------------------------------------------------------

revoke all on function public.soil_phase2_drop_bulk_load_indexes() from public;
grant execute on function public.soil_phase2_drop_bulk_load_indexes() to authenticated;

revoke all on function public.soil_phase2_count_bulk_load_indexes() from public;
grant execute on function public.soil_phase2_count_bulk_load_indexes() to authenticated;

-- ============================================================
-- 注意事項（東海林さん向け）
-- ============================================================
-- 本 migration 適用後:
--   1. admin が server action または SQL Editor で
--      `select * from public.soil_phase2_drop_bulk_load_indexes();` を実行
--      → 12 INDEX が DROP（UNIQUE INDEX は維持）
--   2. scripts/soil-import-csv-phase2.ts で 200 万件取込
--   3. 完了後、SQL Editor で
--      scripts/soil-phase2-recreate-indexes.sql の内容を貼付し Run
--      → CREATE INDEX CONCURRENTLY で全 INDEX 再構築（読込ブロックなし）
--   4. ANALYZE public.soil_lists; で統計情報更新
--   5. `select * from public.soil_phase2_count_bulk_load_indexes();` で確認
--
-- ロールバック:
--   drop function if exists public.soil_phase2_drop_bulk_load_indexes() cascade;
--   drop function if exists public.soil_phase2_count_bulk_load_indexes() cascade;
-- ============================================================
