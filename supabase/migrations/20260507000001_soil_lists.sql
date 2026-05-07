-- ============================================================
-- Garden Soil — リスト本体テーブル `soil_lists` + 補助テーブル
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-25-soil-01-list-master-schema.md（#01 リスト本体スキーマ）
--   - docs/specs/2026-04-25-soil-07-delete-pattern.md（#07 削除パターン横断統一）
--   - docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md（B-03 関電マスタ列追加）
-- 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
--
-- 目的:
--   Garden-Soil の中核となる営業リスト本体（253 万件級顧客マスタ）を定義。
--   Tree（架電）/ Leaf（案件化後）/ Bloom（KPI 集計）から参照される。
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod への適用は東海林さん別途承認後（CLAUDE.md ルール）。
--
-- 冪等性:
--   `create table if not exists` / `create index if not exists` で再実行可能。
-- ============================================================

-- ------------------------------------------------------------
-- 1. リスト本体 soil_lists
-- ------------------------------------------------------------
create table if not exists public.soil_lists (
  id uuid primary key default gen_random_uuid(),

  -- 識別系
  list_no            text unique,                   -- 人間可読の管理番号（旧 Kintone 管理番号）
  source_system      text not null,                 -- 'kintone-app-55' | 'filemaker-list2024' | 'csv-import-YYYYMMDD' | 'walk_in' | 'referral'
  source_record_id   text,                          -- 元システムのレコード ID（追跡用）

  -- 顧客（個人 or 法人）
  customer_type      text not null check (customer_type in ('individual', 'corporate')),
  name_kanji         text,                          -- 姓名（個人）or 法人名（漢字）
  name_kana          text,                          -- 同（カナ）
  representative_name_kanji  text,                  -- 法人代表者（個人 NULL）
  representative_name_kana   text,

  -- 連絡先（複数番号は JSONB、検索は primary を別カラム）
  phone_primary      text,                          -- 検索 / RLS の主軸（正規化済 +81- 形式）
  phone_alternates   jsonb,                         -- [{ "number": "...", "type": "fax|mobile|..." }, ...]
  email_primary      text,
  email_alternates   jsonb,

  -- 住所（請求 / 使用場所 を別途 JSONB で）
  postal_code        text,
  prefecture         text,
  city               text,
  address_line       text,                          -- 番地・建物名
  addresses_jsonb    jsonb,                         -- { "billing": {...}, "usage": {...}, "delivery": {...} }

  -- 商材適性
  industry_type      text,                          -- 工場照明 / 飲食 / 商店 / 寮 / 学校 / 事務所 / 医院 等
  business_size      text check (business_size is null or business_size in ('micro', 'small', 'medium', 'large')),

  -- リスト状態
  status             text not null default 'active'
                     check (status in ('active', 'casecreated', 'churned', 'donotcall', 'merged')),
  status_changed_at  timestamptz,
  status_changed_by  uuid,
  donotcall_reason   text,                          -- 'request' | 'duplicate' | 'cooling' 等

  -- 重複統合
  merged_into_id     uuid references public.soil_lists(id), -- 統合先（自分が「古い」側のとき）

  -- 案件化トラッキング
  primary_case_module text,                         -- 'leaf_kanden' | 'leaf_hikari' | ...
  primary_case_id     uuid,                         -- 該当 Leaf テーブルの id
  case_count          int not null default 0,      -- 関連案件数

  -- B-03 関電マスタ統合（supply_point_22 = 22 桁 不変 ID、不在は NULL）
  supply_point_22     text,                         -- 関電供給地点識別子（22 桁、最高優先 R1 マッチング）
  pd_number           text,                         -- 需要番号（契約切替で変わる）
  old_pd_numbers      jsonb,                        -- 履歴 ['old1', 'old2', ...]

  -- B-03 リスト外フラグ（Kintone App 55 管理外の取込）
  is_outside_list     boolean not null default false,
  source_channel      text,                         -- 'kintone_app55' | 'walk_in' | 'referral' | 'csv_import' 等

  -- メタ
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,

  -- 削除（横断統一規格、#07）
  deleted_at         timestamptz,
  deleted_by         uuid,
  deleted_reason     text,

  -- 22 桁数字の format 制約
  constraint chk_soil_lists_supply_point_22_format
    check (supply_point_22 is null or supply_point_22 ~ '^[0-9]{22}$')
);

comment on table public.soil_lists is
  'Garden-Soil 顧客マスタ（253 万件級、全商材横断の営業リスト本体）';
comment on column public.soil_lists.supply_point_22 is
  '関西電力 電力供給地点識別子（22 桁、不変 ID）。R1 マッチング最高優先。';
comment on column public.soil_lists.merged_into_id is
  '重複統合の前方参照。自身が古い側のとき統合先 id を保持。';
comment on column public.soil_lists.is_outside_list is
  'true = リスト外（営業飛込み等、Kintone App 55 管理外）。false = リスト内（既定）。';

-- ------------------------------------------------------------
-- 2. インデックス（基本のみ。詳細性能は #05 で追加）
-- ------------------------------------------------------------
-- 検索主軸
create index if not exists idx_soil_lists_phone_primary
  on public.soil_lists (phone_primary)
  where phone_primary is not null and deleted_at is null;

create index if not exists idx_soil_lists_name_kanji
  on public.soil_lists (name_kanji)
  where deleted_at is null;

create index if not exists idx_soil_lists_status
  on public.soil_lists (status)
  where deleted_at is null;

-- 案件化トラッキング
create index if not exists idx_soil_lists_primary_case
  on public.soil_lists (primary_case_module, primary_case_id)
  where primary_case_id is not null and deleted_at is null;

-- B-03 関電マスタ: supply_point_22 単独 UNIQUE（NULL 許容で部分 INDEX）
create unique index if not exists uq_soil_lists_supply_point_22
  on public.soil_lists (supply_point_22)
  where supply_point_22 is not null and deleted_at is null;

-- pd_number は重複可（contract切替時に履歴あり）、検索用に通常 INDEX
create index if not exists idx_soil_lists_pd_number
  on public.soil_lists (pd_number)
  where pd_number is not null and deleted_at is null;

-- B-03 リスト外フラグ
create index if not exists idx_soil_lists_is_outside_list
  on public.soil_lists (is_outside_list)
  where deleted_at is null;

-- 重複統合参照
create index if not exists idx_soil_lists_merged_into_id
  on public.soil_lists (merged_into_id)
  where merged_into_id is not null;

-- ------------------------------------------------------------
-- 3. updated_at 自動更新トリガ
-- ------------------------------------------------------------
create or replace function public.soil_lists_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_soil_lists_set_updated_at on public.soil_lists;
create trigger trg_soil_lists_set_updated_at
  before update on public.soil_lists
  for each row execute function public.soil_lists_set_updated_at();

-- ------------------------------------------------------------
-- 4. 補助テーブル soil_list_imports（インポートバッチの追跡）
-- ------------------------------------------------------------
create table if not exists public.soil_list_imports (
  id                uuid primary key default gen_random_uuid(),
  source_system     text not null,                  -- 'kintone-app-55' 等
  source_label      text,                           -- 「2026-04 関電 春季リスト」等
  imported_at       timestamptz not null default now(),
  imported_by       uuid,
  total_records     int not null,
  inserted_count    int not null default 0,
  updated_count     int not null default 0,
  skipped_duplicate_count int not null default 0,
  failed_count      int not null default 0,
  error_summary     jsonb,                          -- 失敗レコードの抜粋（最大 100 件）
  notes             text,

  -- 削除（横断統一規格、#07）
  deleted_at        timestamptz,
  deleted_by        uuid
);

create index if not exists idx_soil_list_imports_source
  on public.soil_list_imports (source_system, imported_at desc)
  where deleted_at is null;

-- ------------------------------------------------------------
-- 5. 補助テーブル soil_list_tags（タグ付け）
-- ------------------------------------------------------------
create table if not exists public.soil_list_tags (
  id         uuid primary key default gen_random_uuid(),
  list_id    uuid not null references public.soil_lists(id) on delete cascade,
  tag        text not null,                          -- 'priority-high' | 'kanden-target' | 'do-not-trust' 等
  added_at   timestamptz not null default now(),
  added_by   uuid,
  unique (list_id, tag)
);

create index if not exists idx_soil_list_tags_tag
  on public.soil_list_tags (tag);

-- ------------------------------------------------------------
-- 6. 重複統合提案テーブル soil_lists_merge_proposals
-- ------------------------------------------------------------
create table if not exists public.soil_lists_merge_proposals (
  id                uuid primary key default gen_random_uuid(),
  primary_list_id   uuid not null references public.soil_lists(id),    -- 残す側（最新）
  duplicate_list_id uuid not null references public.soil_lists(id),    -- 統合される側（古い）
  match_round       text not null,                  -- 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6'
  confidence        numeric(3,2) not null,          -- 0.00 〜 1.00
  proposed_at       timestamptz not null default now(),
  proposed_by       text not null,                  -- 'kintone_sync_cron' | 'admin' 等
  reviewed_at       timestamptz,
  reviewed_by       uuid,
  review_status     text not null default 'pending'
                    check (review_status in ('pending', 'approved', 'rejected', 'merged')),
  review_notes      text,

  -- 削除（横断統一規格、#07）
  deleted_at        timestamptz,
  deleted_by        uuid,

  unique (primary_list_id, duplicate_list_id)
);

create index if not exists idx_soil_lists_merge_proposals_status
  on public.soil_lists_merge_proposals (review_status, proposed_at desc)
  where deleted_at is null;

-- ============================================================
-- end of migration
-- ============================================================
