-- ============================================================
-- Garden Soil — 性能最適化用追加インデックス
-- ============================================================
-- 対応 spec:
--   - docs/specs/2026-04-25-soil-05-index-performance.md（#05 インデックス性能戦略）
-- 作成: 2026-05-07（Batch 16 基盤実装、a-soil）
--
-- 目的:
--   Soil 主要クエリの p95 応答時間目標を満たすための追加インデックス。
--   - リスト一覧 250ms / コール履歴月次集計 800ms（spec §2.1）
--   - 既存 migration 000001 / 000002 の基本 INDEX に対する補完
--   - pg_trgm 拡張による全文検索基盤（B-04 で MV 化される前段）
--
-- 構成:
--   1. soil_lists の補完インデックス（業種×地域 / source 一意 / list_no 等）
--   2. pg_trgm 拡張 + trigram GIN インデックス（名前・住所の部分一致検索）
--   3. soil_call_history の追加インデックス（KPI 集計用 partial index）
--   4. 補助テーブル（imports / tags / merge_proposals）の補完
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   garden-prod 適用は東海林さん別途承認後（CLAUDE.md ルール）。
--   ※ 大規模テーブルへの GIN INDEX 作成は 5-15 分を要する可能性あり、
--     初回適用時は CONCURRENTLY 化を検討（現時点では空テーブル前提で通常 INDEX）。
--
-- 冪等性:
--   `create extension if not exists` / `create index if not exists` で再実行可能。
-- ============================================================

-- ------------------------------------------------------------
-- 1. soil_lists 補完インデックス
-- ------------------------------------------------------------

-- ソース連携（Kintone 再インポート時の UPSERT 主キー）
create unique index if not exists idx_soil_lists_source
  on public.soil_lists (source_system, source_record_id)
  where source_record_id is not null and deleted_at is null;

-- 業種 × 地域での複合検索（active のみ）
create index if not exists idx_soil_lists_industry_pref
  on public.soil_lists (industry_type, prefecture, status)
  where status = 'active' and deleted_at is null;

-- 削除済除外の高速化（spec §3.1 #7、deleted_at IS NULL を頻繁にフィルタ）
create index if not exists idx_soil_lists_active_records
  on public.soil_lists (id)
  where deleted_at is null;

-- リスト管理番号（人間可読 ID 検索）
create index if not exists idx_soil_lists_list_no
  on public.soil_lists (list_no)
  where list_no is not null;

-- ------------------------------------------------------------
-- 2. pg_trgm 拡張 + trigram GIN INDEX
-- ------------------------------------------------------------
-- pg_trgm: PostgreSQL 拡張（部分一致 / 類似度検索の高速化）
-- Supabase 標準で利用可能、既に他モジュールで有効化されていれば NO-OP
create extension if not exists pg_trgm;

-- 名前（漢字 + カナ）の trigram GIN（営業部門による部分一致検索）
create index if not exists idx_soil_lists_name_trgm
  on public.soil_lists using gin (name_kanji gin_trgm_ops, name_kana gin_trgm_ops);

-- 住所の trigram GIN（地域絞り込み + 部分一致）
create index if not exists idx_soil_lists_address_trgm
  on public.soil_lists using gin (address_line gin_trgm_ops);

-- ------------------------------------------------------------
-- 3. soil_call_history 追加インデックス
-- ------------------------------------------------------------
-- KPI 集計用 partial INDEX（is_billable = true AND call_mode IN (sprout,branch,leaf,bloom)）
-- noresponse / misdial / fruit を除外してインデックスサイズ縮減
create index if not exists idx_soil_call_history_billable_mode
  on public.soil_call_history (call_mode, call_datetime desc)
  where is_billable = true
    and call_mode in ('sprout', 'branch', 'leaf', 'bloom');

-- リスト × 日付（リスト詳細画面の架電履歴タイムライン）
create index if not exists idx_soil_call_history_list_dt
  on public.soil_call_history (list_id, call_datetime desc);

-- outcome 集計（成果別 KPI）
create index if not exists idx_soil_call_history_outcome
  on public.soil_call_history (outcome, call_datetime desc)
  where outcome is not null;

-- ------------------------------------------------------------
-- 4. 補助テーブル補完
-- ------------------------------------------------------------

-- soil_list_tags: list_id と tag の複合検索高速化（既に UNIQUE(list_id, tag) あり、別軸として）
create index if not exists idx_soil_list_tags_list_id
  on public.soil_list_tags (list_id);

-- soil_list_imports: imported_at desc の単独 INDEX（最新インポートバッチ参照）
create index if not exists idx_soil_list_imports_imported_at
  on public.soil_list_imports (imported_at desc)
  where deleted_at is null;

-- soil_lists_merge_proposals: pending 状態の高速参照（admin 一覧画面用）
create index if not exists idx_soil_lists_merge_proposals_pending
  on public.soil_lists_merge_proposals (proposed_at desc)
  where review_status = 'pending' and deleted_at is null;

-- ------------------------------------------------------------
-- 5. memo 全文検索（Phase C 後期、#05 §4.3）— 当面 defer
-- ------------------------------------------------------------
-- memo trigram GIN は Phase C 後期で追加予定。335 万件 INSERT 中の memo 重量を
-- 計測してから判断（5 文字超のみ対象 partial index 想定）。

-- ============================================================
-- 注意事項（東海林さん向け）
-- ============================================================
-- 本 migration 適用後の状態:
--   - soil_lists に 4 INDEX 追加（補完 + UNIQUE source）
--   - pg_trgm 拡張有効化（既に有効なら NO-OP）
--   - 名前・住所への GIN trigram INDEX 2 件
--   - soil_call_history に 3 INDEX 追加（KPI partial / リスト詳細 / outcome）
--   - 補助テーブル 3 種に各 1 INDEX 追加
--
-- ストレージ影響:
--   - 空テーブルへの INDEX 作成は瞬時
--   - 253 万件投入後の再作成は CONCURRENTLY 必須（INSERT ブロック回避）
--
-- ロールバック:
--   drop index if exists ... で各 INDEX 個別削除可
--   pg_trgm 拡張は他モジュールでも利用するため drop しない
-- ============================================================
