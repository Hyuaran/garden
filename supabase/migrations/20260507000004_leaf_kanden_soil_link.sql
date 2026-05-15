-- ============================================================
-- Garden Soil-Leaf 連携 — leaf_kanden_cases に Soil 連携列追加
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-25-soil-03-kanden-list-integration.md（#03 関電 Leaf 連携）
--   - docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md（B-03 master 統合）
-- 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
--
-- 目的:
--   既存稼働中の `leaf_kanden_cases` に Soil との連携列を **加算的に** 追加。
--   Soil = master / Leaf = ミラーの関係を物理化する第 1 段階。
--
-- 加算的 migration の方針:
--   - 全列 NULLABLE で追加（既存データへの即時影響なし）
--   - FK 制約も初期は ON DELETE NO ACTION のみ（NOT NULL 化はバックフィル後）
--   - case_type は DEFAULT 'latest' で既存データは latest 扱い
--
-- 後続作業（本 migration の対象外）:
--   1. B-01 リストインポート完走後、leaf_kanden_cases.soil_list_id をバックフィル
--   2. バックフィル完了後、別 migration で soil_list_id NOT NULL 化
--   3. handle_pd_number_change() Server Action 実装（B-03 §6）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後（CLAUDE.md ルール）。
--
-- 冪等性:
--   `add column if not exists` / `create index if not exists` で再実行可能。
-- ============================================================

-- ------------------------------------------------------------
-- 1. leaf_kanden_cases に Soil 連携列を追加（全 NULLABLE）
-- ------------------------------------------------------------
alter table public.leaf_kanden_cases
  add column if not exists soil_list_id uuid references public.soil_lists(id);

alter table public.leaf_kanden_cases
  add column if not exists case_type text default 'latest';

-- case_type の CHECK 制約は別途追加（既存データの latest 既定後）
-- 既存データに NULL があると CHECK 失敗するので、UPDATE で latest セット後に制約付与
update public.leaf_kanden_cases
   set case_type = 'latest'
 where case_type is null;

alter table public.leaf_kanden_cases
  alter column case_type set not null;

-- 重複制約防止: drop してから add（冪等性）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_leaf_kanden_cases_case_type'
  ) then
    alter table public.leaf_kanden_cases
      add constraint chk_leaf_kanden_cases_case_type
      check (case_type in ('latest', 'replaced', 'makinaoshi', 'outside'));
  end if;
end $$;

-- pd_number / old_pd_number / 切替メタ
alter table public.leaf_kanden_cases
  add column if not exists pd_number text;

alter table public.leaf_kanden_cases
  add column if not exists old_pd_number text;

alter table public.leaf_kanden_cases
  add column if not exists replaced_at timestamptz;

alter table public.leaf_kanden_cases
  add column if not exists replaced_by uuid;

comment on column public.leaf_kanden_cases.soil_list_id is
  'Soil 顧客マスタへの参照。B-01 バックフィル完走後に NOT NULL 化予定。';
comment on column public.leaf_kanden_cases.case_type is
  '案件種別: latest=最新有効 / replaced=契約切替済の旧 / makinaoshi=巻き直し / outside=リスト外。既存データは latest 既定。';
comment on column public.leaf_kanden_cases.pd_number is
  '需要番号（現行）。契約切替時に変更される。同一 supply_point_22 で複数 pd_number 履歴を持つ。';
comment on column public.leaf_kanden_cases.old_pd_number is
  '直前の需要番号（履歴）。replaced 時に保持。';

-- ------------------------------------------------------------
-- 2. インデックス（B-03 §3.4）
-- ------------------------------------------------------------
create index if not exists idx_leaf_kanden_cases_soil_list_id
  on public.leaf_kanden_cases (soil_list_id)
  where soil_list_id is not null;

create index if not exists idx_leaf_kanden_cases_case_type
  on public.leaf_kanden_cases (case_type, soil_list_id);

create index if not exists idx_leaf_kanden_cases_pd_number
  on public.leaf_kanden_cases (pd_number)
  where pd_number is not null;

-- ------------------------------------------------------------
-- 3. soil_lists_assignments MV の REFRESH（RLS migration で作成済 MV）
--    本 migration で leaf_kanden_cases.soil_list_id 列が追加されたため、
--    MV クエリの実行が初めて意味を持つ。CONCURRENTLY ではない初回 REFRESH。
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_matviews where schemaname = 'public' and matviewname = 'soil_lists_assignments'
  ) then
    refresh materialized view public.soil_lists_assignments;
  end if;
end $$;

-- ============================================================
-- 注意事項（東海林さん向け）
-- ============================================================
-- 本 migration 適用後の状態:
--   - leaf_kanden_cases に 6 列追加（全 NULLABLE、case_type は DEFAULT 'latest'）
--   - 既存データへの破壊的変更なし
--   - soil_list_id 列は B-01 バックフィル完走まで NULL のまま
--
-- B-01 バックフィル戦略（次セッション以降）:
--   1. supply_point_22 で R1 マッチング（Soil 既存に同一 22 桁あれば紐付け）
--   2. R1 不一致 → R2-R5 で phone + name 照合
--   3. すべて不一致 → 新規 soil_lists INSERT + soil_list_id 紐付け
--   4. バックフィル完了後、別 migration で soil_list_id NOT NULL 化
--
-- ロールバック:
--   alter table public.leaf_kanden_cases drop column soil_list_id, drop column case_type, ...
--   ※ 列追加のみなのでロールバックは安全（既存データに影響なし）
-- ============================================================
