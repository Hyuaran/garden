-- ============================================================
-- Garden Soil Phase 2 — INDEX 再構築（CONCURRENTLY、読込ブロックなし）
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §6.2
--
-- 実行タイミング:
--   Phase 2 (FileMaker CSV 200 万件) の取込完了後に Supabase Dashboard SQL Editor で実行。
--
-- 重要:
--   CREATE INDEX CONCURRENTLY は transaction block 外でしか実行できない。
--   そのため migration / PL/pgSQL function には入れず、
--   admin が SQL Editor から直接実行する運用とする。
--
-- 想定所要時間（230 万件想定、spec §6.3）:
--   - idx_soil_lists_phone_primary（部分）        ~2 分
--   - idx_soil_lists_name_kanji（部分）          ~3 分
--   - idx_soil_lists_industry_pref（複合）       ~5 分
--   - idx_soil_lists_name_trgm（GIN trigram）    ~30-60 分（重い、夜間推奨）
--   - idx_soil_lists_address_trgm（GIN trigram） ~20-40 分（重い、夜間推奨）
--   - 他の小さな INDEX                            ~1-2 分 each
--
-- 実行手順:
--   1. Supabase Dashboard > SQL Editor を開く
--   2. 本ファイルの内容を貼付
--   3. Run（個別 INDEX ごとに進捗確認可、CONCURRENTLY のため読込ブロックなし）
--   4. 全完走後、ANALYZE public.soil_lists; を実行（クエリプランナー統計更新）
--   5. select * from public.soil_phase2_count_bulk_load_indexes(); で確認（全 true なら OK）
--
-- 失敗時:
--   CONCURRENTLY 失敗（duplicate / lock conflict 等）時は INDEX が INVALID 状態で残る。
--   `drop index if exists public.<index_name>;` で削除後、再実行。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 基本 INDEX（migration 000001 由来）
-- ------------------------------------------------------------

create index concurrently if not exists idx_soil_lists_phone_primary
  on public.soil_lists (phone_primary)
  where phone_primary is not null and deleted_at is null;

create index concurrently if not exists idx_soil_lists_name_kanji
  on public.soil_lists (name_kanji)
  where deleted_at is null;

create index concurrently if not exists idx_soil_lists_status
  on public.soil_lists (status)
  where deleted_at is null;

create index concurrently if not exists idx_soil_lists_primary_case
  on public.soil_lists (primary_case_module, primary_case_id)
  where primary_case_id is not null;

create index concurrently if not exists idx_soil_lists_pd_number
  on public.soil_lists (pd_number)
  where pd_number is not null;

create index concurrently if not exists idx_soil_lists_is_outside_list
  on public.soil_lists (is_outside_list)
  where is_outside_list = true;

create index concurrently if not exists idx_soil_lists_merged_into_id
  on public.soil_lists (merged_into_id)
  where merged_into_id is not null;

-- ------------------------------------------------------------
-- 2. 補完 INDEX（migration 000005 由来）
-- ------------------------------------------------------------

create index concurrently if not exists idx_soil_lists_industry_pref
  on public.soil_lists (industry_type, prefecture, status)
  where status = 'active' and deleted_at is null;

create index concurrently if not exists idx_soil_lists_active_records
  on public.soil_lists (id)
  where deleted_at is null;

create index concurrently if not exists idx_soil_lists_list_no
  on public.soil_lists (list_no)
  where list_no is not null;

-- ------------------------------------------------------------
-- 3. trigram GIN INDEX（重い、最後に実行推奨）
-- ------------------------------------------------------------
-- pg_trgm 拡張は migration 000005 で有効化済（既に有効なら NO-OP 不要）

create index concurrently if not exists idx_soil_lists_name_trgm
  on public.soil_lists using gin (name_kanji gin_trgm_ops, name_kana gin_trgm_ops);

create index concurrently if not exists idx_soil_lists_address_trgm
  on public.soil_lists using gin (address_line gin_trgm_ops);

-- ------------------------------------------------------------
-- 4. 統計情報更新（必須）
-- ------------------------------------------------------------
-- INDEX 再構築完了後、必ず実行（クエリプランナーが新 INDEX を使うため）
-- CONCURRENTLY 適用中の ANALYZE は問題なし（短時間で完了）

analyze public.soil_lists;

-- ------------------------------------------------------------
-- 5. 確認クエリ
-- ------------------------------------------------------------

-- 全 INDEX 再作成済か確認
select * from public.soil_phase2_count_bulk_load_indexes();

-- INDEX サイズ確認（最終的なストレージ消費）
select
  i.indexname,
  pg_size_pretty(pg_relation_size(format('public.%I', i.indexname)::regclass)) as size
from pg_indexes i
where i.schemaname = 'public'
  and i.tablename = 'soil_lists'
order by pg_relation_size(format('public.%I', i.indexname)::regclass) desc;
