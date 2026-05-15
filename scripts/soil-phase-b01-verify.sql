-- ============================================================
-- Soil Phase B-01 apply 後 検証 SQL（8 migration 各ステップ用）
-- ============================================================
-- 対応 dispatch: main- No. 294 §C-3
-- 作成: 2026-05-11（a-soil-002）
--
-- 目的:
--   8 migration の各 apply 後に Supabase SQL Editor で実行し、
--   テーブル / 列 / 制約 / RLS / INDEX が正しく作成されたか確認する。
--
-- 実行方法:
--   runbook §2-2 の手順通り、該当 migration apply 後にセクションを Run。
--   全セクション独立、結果を runbook §3 の "実行結果" 欄に転記。
--
-- 結果期待値:
--   各セクション末尾に「期待:」コメント有り。期待と一致しなければ apply 失敗。
-- ============================================================

-- ============================================================
-- Section 0. rename migration (20260511170000) 後の検証
-- ============================================================

-- 0-1. legacy 退避先テーブル存在 + 旧名空きスロット
select
  table_name,
  case when table_name = 'soil_call_history' then '空きスロット OK' else 'rename 済' end as status
from information_schema.tables
where table_schema = 'public'
  and table_name in ('soil_call_history', 'soil_call_history_legacy_tree_20260511');
-- 期待: 1 行 = soil_call_history_legacy_tree_20260511（rename 済）のみ
--       soil_call_history は 0 行（空きスロット）

-- ============================================================
-- Section 1. 20260507000001_soil_lists.sql 後の検証
-- ============================================================

-- 1-1. soil_lists + 補助テーブル 4 件
select count(*) as table_count
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'soil_lists', 'soil_list_imports', 'soil_list_tags', 'soil_lists_merge_proposals'
  );
-- 期待: 4

-- 1-2. soil_lists 主要列
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'soil_lists'
  and column_name in (
    'id', 'list_no', 'source_system', 'source_record_id', 'customer_type',
    'name_kanji', 'phone_primary', 'status', 'supply_point_22', 'pd_number',
    'is_outside_list', 'source_channel'
  )
order by column_name;
-- 期待: 12 行（B-03 関電列含む）

-- 1-3. soil_lists PK = uuid + 主要 INDEX
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'soil_lists'
  and indexname in (
    'soil_lists_pkey',
    'idx_soil_lists_phone_primary',
    'idx_soil_lists_name_kanji',
    'idx_soil_lists_status',
    'uq_soil_lists_supply_point_22'
  )
order by indexname;
-- 期待: 5 行

-- ============================================================
-- Section 2. 20260507000002_soil_call_history.sql 後の検証
-- ============================================================

-- 2-1. soil_call_history が PARTITIONED で作成されたか
select
  c.relname as table_name,
  case when pt.partrelid is not null then '✅ PARTITIONED' else '❌ 非 PARTITIONED' end as status,
  case when pt.partrelid is not null then pg_get_partkeydef(pt.partrelid) end as partition_key
from pg_class c
left join pg_partitioned_table pt on pt.partrelid = c.oid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'soil_call_history';
-- 期待: 1 行 = ✅ PARTITIONED、partition_key = RANGE (call_datetime)

-- 2-2. 月次パーティション数（16 ヶ月分 + default）
select count(*) as partition_count
from pg_inherits i
join pg_class c on c.oid = i.inhrelid
join pg_class p on p.oid = i.inhparent
where p.relname = 'soil_call_history' and c.relkind = 'r';
-- 期待: 17（16 ヶ月 + 1 default）

-- 2-3. compute_duration トリガー存在
select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'soil_call_history'
  and trigger_name = 'trg_soil_call_history_compute_duration';
-- 期待: BEFORE INSERT / BEFORE UPDATE の 2 行

-- ============================================================
-- Section 3. 20260507000003_soil_rls.sql 後の検証
-- ============================================================

-- 3-1. RLS 有効化テーブル
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'soil_lists', 'soil_call_history', 'soil_list_tags',
    'soil_list_imports', 'soil_lists_merge_proposals'
  )
order by tablename;
-- 期待: 全 5 件 rowsecurity = true

-- 3-2. helper 関数（current_garden_role / current_department_id）
select proname, prosrc is not null as has_body
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('current_garden_role', 'current_department_id', 'refresh_soil_lists_assignments');
-- 期待: 3 行（has_body = true）

-- 3-3. RLS policy 数（テーブル別）
select tablename, count(*) as policy_count
from pg_policies
where schemaname = 'public'
  and tablename in (
    'soil_lists', 'soil_call_history', 'soil_list_tags',
    'soil_list_imports', 'soil_lists_merge_proposals'
  )
group by tablename
order by tablename;
-- 期待: 各テーブル 2-4 policy（SELECT / INSERT / UPDATE / DELETE 系）

-- ============================================================
-- Section 4. 20260507000004_leaf_kanden_soil_link.sql 後の検証
-- ============================================================

-- 4-1. leaf_kanden_cases の Soil 連携列追加
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leaf_kanden_cases'
  and column_name in ('soil_list_id', 'case_type', 'pd_number');
-- 期待: 3 行（spec によりさらに増える可能性あり）

-- ============================================================
-- Section 5. 20260507000005_soil_indexes.sql 後の検証
-- ============================================================

-- 5-1. pg_trgm 拡張
select extname, extversion from pg_extension where extname = 'pg_trgm';
-- 期待: 1 行

-- 5-2. trigram GIN INDEX
select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'soil_lists'
  and indexname in ('idx_soil_lists_name_trgm', 'idx_soil_lists_address_trgm');
-- 期待: 2 行（using gin）

-- 5-3. 性能 INDEX 全件（migration 000001 + 000005 合算）
select count(*) as soil_lists_index_count
from pg_indexes
where schemaname = 'public' and tablename = 'soil_lists';
-- 期待: 12+（spec 通り）

-- ============================================================
-- Section 6. 20260507000006_soil_handle_pd_number_change.sql 後の検証
-- ============================================================

-- 6-1. DB 関数 handle_pd_number_change 存在
select proname, pronargs
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname = 'handle_pd_number_change';
-- 期待: 1 行

-- ============================================================
-- Section 7. 20260507000007_soil_imports_staging.sql 後の検証
-- ============================================================

-- 7-1. staging テーブル 3 件
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('soil_imports_staging', 'soil_imports_normalized', 'soil_imports_errors')
order by table_name;
-- 期待: 3 行

-- 7-2. staging に必須列
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'soil_imports_staging'
  and column_name in ('import_job_id', 'chunk_id', 'raw_payload', 'source_record_id')
order by column_name;
-- 期待: 4 行

-- ============================================================
-- Section 8. 20260509000001_soil_phase2_index_helpers.sql 後の検証
-- ============================================================

-- 8-1. Phase 2 INDEX helper 関数 2 件
select proname, pronargs
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('soil_phase2_drop_bulk_load_indexes', 'soil_phase2_count_bulk_load_indexes');
-- 期待: 2 行

-- 8-2. Phase 2 INDEX 観測関数の動作確認（INDEX が再構築前なので一部 false でも OK）
select * from public.soil_phase2_count_bulk_load_indexes();
-- 期待: 12 行（全 INDEX 名が列挙、exists = true / false は状態次第）

-- ============================================================
-- Section 9. 最終総合確認
-- ============================================================

-- 9-1. Soil 関連テーブル全件
select table_name, table_type
from information_schema.tables
where table_schema = 'public'
  and (
    table_name like 'soil_%'
    or table_name like 'soil_call_history_%'  -- partitions
  )
order by table_name;
-- 期待:
--   soil_call_history (PARTITIONED 親)
--   soil_call_history_default (default partition)
--   soil_call_history_202505 〜 soil_call_history_202608 (16 partitions)
--   soil_call_history_legacy_tree_20260511 (legacy 退避)
--   soil_imports_errors / soil_imports_normalized / soil_imports_staging
--   soil_list_imports / soil_list_tags / soil_lists / soil_lists_merge_proposals
--   合計: 約 25 行

-- 9-2. Soil 関連関数全件
select proname
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname like 'soil_%'
     or proname in ('current_garden_role', 'current_department_id', 'handle_pd_number_change')
order by proname;
-- 期待: soil_lists_set_updated_at / soil_call_history_compute_duration /
--        soil_call_history_ensure_partition / handle_pd_number_change /
--        current_garden_role / current_department_id /
--        refresh_soil_lists_assignments /
--        soil_phase2_drop_bulk_load_indexes / soil_phase2_count_bulk_load_indexes
--        ほぼ 9 行

-- 9-3. 行数最終チェック（既存データ保護確認）
select 'legacy table' as label, count(*) as row_count
from public.soil_call_history_legacy_tree_20260511;
-- 期待: preflight §3 で記録した行数と完全一致（EMP-1324 等の実データ保護）
