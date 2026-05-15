-- ============================================================
-- Garden Soil — Phase B-01 リストインポート staging テーブル群
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 §3.3 staging 方式）
-- 作成: 2026-05-07（Phase B-01 skeleton、a-soil）
--
-- 目的:
--   Kintone API → soil_lists の取込パイプラインの中間層を提供。
--   Extract → Transform → Load の各段階で失敗時の resume / retry を可能にする。
--
-- フロー:
--   [ Kintone API ]
--          ↓ (cursor pagination, 500 件/req)
--   [ soil_imports_staging ]  -- raw JSONB, no constraints, COPY 高速
--          ↓ (Transform: E.164 / zenkaku→hankaku / 業種コード)
--   [ soil_imports_normalized ] -- 型付き、検証済
--          ↓ (upsert ON CONFLICT (source_system, source_record_id))
--   [ soil_lists ]              -- 本番テーブル
--
-- chunk 設計:
--   - chunk size = 5,000 件（30 万件 ÷ 5,000 = 60 chunks）
--   - 1 chunk = 1 トランザクション
--   - chunk 失敗時はその chunk のみ rollback、次の chunk は継続
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後。
--
-- 冪等性:
--   `create table if not exists` で再実行可能。
-- ============================================================

-- ------------------------------------------------------------
-- 1. soil_imports_staging（Extract 段階の raw JSONB）
-- ------------------------------------------------------------
create table if not exists public.soil_imports_staging (
  id              bigserial primary key,
  import_job_id   uuid not null references public.soil_list_imports(id) on delete cascade,
  chunk_id        int not null,                        -- 1, 2, 3, ... (順序)
  raw_payload     jsonb not null,                      -- Kintone レコードそのまま
  source_system   text not null,                       -- 'kintone-app-55' 等
  source_record_id text,                               -- Kintone レコード ID（追跡用、indexable）
  fetched_at      timestamptz not null default now()
);

create index if not exists idx_soil_imports_staging_job
  on public.soil_imports_staging (import_job_id, chunk_id);

create index if not exists idx_soil_imports_staging_source_record
  on public.soil_imports_staging (source_system, source_record_id)
  where source_record_id is not null;

comment on table public.soil_imports_staging is
  'Phase B-01 取込 staging（Extract 段階）。raw JSONB を chunk 単位で保持、resume 用。';

-- ------------------------------------------------------------
-- 2. soil_imports_normalized（Transform 段階の型付きデータ）
-- ------------------------------------------------------------
create table if not exists public.soil_imports_normalized (
  id              bigserial primary key,
  import_job_id   uuid not null references public.soil_list_imports(id) on delete cascade,
  chunk_id        int not null,
  staging_id      bigint references public.soil_imports_staging(id) on delete cascade,
  source_system   text not null,
  source_record_id text not null,

  -- soil_lists の主要列に対応する正規化済値
  customer_type   text,                                -- 'individual' | 'corporate'
  name_kanji      text,
  name_kana       text,
  phone_primary   text,                                -- E.164 形式（normalizePhone 適用済）
  email_primary   text,
  postal_code     text,
  prefecture      text,
  city            text,
  address_line    text,
  industry_type   text,
  business_size   text,
  supply_point_22 text,
  pd_number       text,

  -- Transform 結果
  transform_status text not null default 'pending'
                  check (transform_status in ('pending', 'success', 'error')),
  transform_error  text,                              -- エラー詳細（transform_status='error' 時）
  transformed_at   timestamptz,

  -- Load 結果
  loaded_status   text default 'pending'
                  check (loaded_status in ('pending', 'inserted', 'updated', 'skipped', 'error')),
  loaded_at       timestamptz,
  loaded_soil_list_id uuid references public.soil_lists(id),
  load_error      text
);

create index if not exists idx_soil_imports_normalized_job
  on public.soil_imports_normalized (import_job_id, chunk_id);

create index if not exists idx_soil_imports_normalized_status
  on public.soil_imports_normalized (transform_status, loaded_status);

create index if not exists idx_soil_imports_normalized_source
  on public.soil_imports_normalized (source_system, source_record_id);

comment on table public.soil_imports_normalized is
  'Phase B-01 取込 normalized（Transform 段階）。型変換・正規化済データを保持、Load 段階で参照。';

-- ------------------------------------------------------------
-- 3. soil_imports_errors（エラー集約）
-- ------------------------------------------------------------
create table if not exists public.soil_imports_errors (
  id              bigserial primary key,
  import_job_id   uuid not null references public.soil_list_imports(id) on delete cascade,
  chunk_id        int,
  source_record_id text,
  error_phase     text not null
                  check (error_phase in ('extract', 'transform', 'load')),
  error_type      text not null,                      -- 'api_error' | 'validation' | 'constraint_violation' 等
  error_message   text not null,
  error_details   jsonb,
  occurred_at     timestamptz not null default now()
);

create index if not exists idx_soil_imports_errors_job
  on public.soil_imports_errors (import_job_id, error_phase);

create index if not exists idx_soil_imports_errors_recent
  on public.soil_imports_errors (occurred_at desc);

comment on table public.soil_imports_errors is
  'Phase B-01 取込エラー集約。phase 別に error 詳細を保存し、retry 判断に利用。';

-- ------------------------------------------------------------
-- 4. soil_list_imports に Phase B-01 拡張列追加
-- ------------------------------------------------------------
-- 既存テーブル（migration 000001）に進捗追跡用列を追加
alter table public.soil_list_imports
  add column if not exists job_status text default 'queued'
    check (job_status in ('queued', 'running', 'paused', 'failed', 'completed', 'cancelled'));

alter table public.soil_list_imports
  add column if not exists chunks_total int;

alter table public.soil_list_imports
  add column if not exists chunks_completed int default 0;

alter table public.soil_list_imports
  add column if not exists last_chunk_completed_at timestamptz;

alter table public.soil_list_imports
  add column if not exists started_at timestamptz;

alter table public.soil_list_imports
  add column if not exists completed_at timestamptz;

create index if not exists idx_soil_list_imports_status
  on public.soil_list_imports (job_status, imported_at desc)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 5. RLS（admin+ のみ管理可）
-- ------------------------------------------------------------
alter table public.soil_imports_staging enable row level security;
alter table public.soil_imports_normalized enable row level security;
alter table public.soil_imports_errors enable row level security;

drop policy if exists soil_imports_staging_admin on public.soil_imports_staging;
create policy soil_imports_staging_admin
  on public.soil_imports_staging for all
  to authenticated
  using (public.current_garden_role() in ('admin', 'super_admin'))
  with check (public.current_garden_role() in ('admin', 'super_admin'));

drop policy if exists soil_imports_normalized_admin on public.soil_imports_normalized;
create policy soil_imports_normalized_admin
  on public.soil_imports_normalized for all
  to authenticated
  using (public.current_garden_role() in ('admin', 'super_admin'))
  with check (public.current_garden_role() in ('admin', 'super_admin'));

drop policy if exists soil_imports_errors_admin on public.soil_imports_errors;
create policy soil_imports_errors_admin
  on public.soil_imports_errors for all
  to authenticated
  using (public.current_garden_role() in ('admin', 'super_admin'))
  with check (public.current_garden_role() in ('admin', 'super_admin'));

-- ============================================================
-- 注意事項（東海林さん向け）
-- ============================================================
-- 本 migration 適用後の状態:
--   - 3 staging テーブル新規作成（admin+ のみ R/W、service_role は RLS バイパス）
--   - soil_list_imports に進捗追跡列 6 件追加
--
-- ストレージ目安:
--   - staging: 30 万件 × ~2KB JSONB ≈ 600MB（取込中のみ、完了後は truncate 可）
--   - normalized: 30 万件 × ~1KB ≈ 300MB
--   - errors: 想定エラー率 0.1% 未満で ~300 件以下
--
-- 取込スクリプト（次セッション以降）:
--   - scripts/soil-import-kintone.ts（cursor 取得 → staging COPY）
--   - scripts/soil-transform.ts（staging → normalized）
--   - scripts/soil-load.ts（normalized → soil_lists upsert）
-- ============================================================
