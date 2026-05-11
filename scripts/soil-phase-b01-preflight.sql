-- ============================================================
-- Soil Phase B-01 apply 前 preflight 検証 SQL
-- ============================================================
-- 対応 dispatch: main- No. 294 §C-3 + §H-1
-- 作成: 2026-05-11（a-soil-002）
--
-- 目的:
--   Phase B-01 8 件の migration を apply する前に、
--   garden-dev 既存状態を SELECT で把握する。
--   特に legacy soil_call_history（Tree 残骸）の列構造・行数・inbound FK を記録し、
--   Tree D-01 spec 修正（# 290 で a-tree-002 担当）の入力資料とする。
--
-- 実行方法:
--   Supabase Dashboard > SQL Editor に貼付して順次 Run、結果を控える。
--   全クエリ独立。失敗しても他クエリは継続実行 OK。
--
-- 結果の扱い:
--   各クエリ結果を runbook §1-2 に転記、a-main-023 / a-tree-002 に共有。
-- ============================================================

-- ------------------------------------------------------------
-- 1. Soil 関連テーブルの現状（rename 前の最終状態）
-- ------------------------------------------------------------

-- 1-1. Soil 関連テーブルの存在確認
select
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
  and (
    table_name like 'soil_%'
    or table_name = 'soil_call_history_legacy_tree_20260511'
  )
order by table_name;

-- 1-2. PARTITIONED テーブルの判定（Soil 仕様 = PARTITIONED）
select
  c.relname as table_name,
  case when pt.partrelid is not null then '✅ PARTITIONED' else '❌ 非 PARTITIONED' end as partition_status,
  case
    when pt.partrelid is not null then pg_get_partkeydef(pt.partrelid)
    else null
  end as partition_key
from pg_class c
left join pg_partitioned_table pt on pt.partrelid = c.oid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('soil_call_history', 'soil_call_history_legacy_tree_20260511')
order by c.relname;

-- ------------------------------------------------------------
-- 2. legacy soil_call_history の列構造（rename 前に記録）
-- ------------------------------------------------------------
-- 注: rename 後は soil_call_history_legacy_tree_20260511 で同じ結果が出る。
-- rename 前後どちらでも本クエリは正しく動く（WHERE 句で両名称を許容）。

select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('soil_call_history', 'soil_call_history_legacy_tree_20260511')
order by table_name, ordinal_position;

-- ------------------------------------------------------------
-- 3. legacy soil_call_history の行数（EMP-1324 含む既存実データ）
-- ------------------------------------------------------------
-- 注: rename 前 = soil_call_history、rename 後 = soil_call_history_legacy_tree_20260511
-- いずれかに行があるはず。rename 前後で行数が一致することを確認。

do $$
declare
  v_count_legacy   bigint := 0;
  v_count_renamed  bigint := 0;
  v_exists_legacy  boolean;
  v_exists_renamed boolean;
begin
  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history'
  ) into v_exists_legacy;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'soil_call_history_legacy_tree_20260511'
  ) into v_exists_renamed;

  if v_exists_legacy then
    execute 'select count(*) from public.soil_call_history' into v_count_legacy;
  end if;

  if v_exists_renamed then
    execute 'select count(*) from public.soil_call_history_legacy_tree_20260511' into v_count_renamed;
  end if;

  raise notice '[preflight] soil_call_history（legacy 名）行数: %', v_count_legacy;
  raise notice '[preflight] soil_call_history_legacy_tree_20260511 行数: %', v_count_renamed;
end $$;

-- ------------------------------------------------------------
-- 4. inbound FK 検出（他テーブルから legacy への参照）
-- ------------------------------------------------------------
-- Tree 等の参照を Tree D-01 spec 修正（# 290）の入力に使う。

select
  tc.table_schema as from_schema,
  tc.table_name as from_table,
  kcu.column_name as from_column,
  ccu.table_schema as to_schema,
  ccu.table_name as to_table,
  ccu.column_name as to_column,
  tc.constraint_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
  and tc.table_schema = kcu.table_schema
join information_schema.constraint_column_usage ccu
  on tc.constraint_name = ccu.constraint_name
  and tc.table_schema = ccu.table_schema
where tc.constraint_type = 'FOREIGN KEY'
  and (
    ccu.table_name in ('soil_call_history', 'soil_call_history_legacy_tree_20260511', 'soil_lists')
  )
order by from_schema, from_table, from_column;

-- ------------------------------------------------------------
-- 5. legacy soil_call_history のインデックス一覧
-- ------------------------------------------------------------

select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('soil_call_history', 'soil_call_history_legacy_tree_20260511')
order by tablename, indexname;

-- ------------------------------------------------------------
-- 6. legacy soil_call_history のトリガー一覧
-- ------------------------------------------------------------

select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('soil_call_history', 'soil_call_history_legacy_tree_20260511')
order by table_name, trigger_name;

-- ------------------------------------------------------------
-- 7. 他 Soil テーブルの存在確認（apply 必要性判定）
-- ------------------------------------------------------------
-- 8 migration が CREATE する全テーブルの apply 状況を確認

with expected as (
  select unnest(array[
    'soil_lists',                          -- 20260507000001
    'soil_list_imports',                   -- 20260507000001
    'soil_list_tags',                      -- 20260507000001
    'soil_lists_merge_proposals',          -- 20260507000001
    'soil_call_history',                   -- 20260507000002
    'soil_call_history_default',           -- 20260507000002 (PARTITION default)
    'leaf_kanden_cases',                   -- 20260507000004（既存の可能性あり、列追加のみ）
    'soil_imports_staging',                -- 20260507000007
    'soil_imports_normalized',             -- 20260507000007
    'soil_imports_errors'                  -- 20260507000007
  ]) as table_name
)
select
  e.table_name,
  case when t.table_name is not null then '✅ 存在' else '❌ 未作成' end as status
from expected e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.table_name
order by e.table_name;

-- ------------------------------------------------------------
-- 8. 既存 PostgreSQL 拡張（pg_trgm が必要、20260507000005 で create extension）
-- ------------------------------------------------------------

select
  extname,
  extversion
from pg_extension
where extname in ('pg_trgm', 'pgcrypto', 'uuid-ossp')
order by extname;
