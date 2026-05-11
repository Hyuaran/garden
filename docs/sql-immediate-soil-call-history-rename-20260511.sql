-- ============================================================
-- 緊急 SQL: soil_call_history 衝突解消（rename）
-- ============================================================
-- 起草: a-main-023 / 2026-05-11 17:30
-- 用途: audit-001 # 15 で発見された silent NO-OP 罠の解消
--
-- 背景:
--   garden-dev に既存 soil_call_history テーブルが存在（Tree D-01 残骸 / 実データ EMP-1324 入り）
--   Soil migration 20260507000002_soil_call_history.sql を apply しても、
--   既存テーブルとの列構造完全不一致を CREATE TABLE IF NOT EXISTS が無視（silent NO-OP）
--   → 既存テーブルを rename して、Soil migration が正しい schema で CREATE できる状態にする
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイル内容を貼付 + Run
--   破壊的操作なし（DROP ではなく RENAME、データ全保持）
--   所要: 10 秒
--
-- 注意:
--   - 既存テーブルはデータ保持のため legacy 名で残す（DROP 不可）
--   - Tree D-01 が実データ書込中の可能性（5/11 17:00 apply 完了後の動作確認は別途必要）
--   - 本 SQL 実行後、a-soil-002 が起草する Soil migration 8 件 apply 計画 (# 294 後) を続行
-- ============================================================

-- ------------------------------------------------------------
-- 事前確認: 既存テーブル存在 + 行数把握
-- ------------------------------------------------------------

-- 既存 soil_call_history 存在確認（期待: 1 行 = 存在）
SELECT to_regclass('public.soil_call_history') AS existing_table;

-- 既存データ行数確認（参考、行数記録）
SELECT count(*) AS existing_row_count FROM public.soil_call_history;

-- 既存列構造確認（参考、移行時の整合確認用）
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'soil_call_history'
ORDER BY ordinal_position;

-- ------------------------------------------------------------
-- 本体: rename（破壊的でない、データ全保持）
-- ------------------------------------------------------------

ALTER TABLE public.soil_call_history
  RENAME TO soil_call_history_legacy_tree_20260511;

-- ------------------------------------------------------------
-- 事後確認: rename 成功 + 新 schema apply 可能状態
-- ------------------------------------------------------------

-- legacy 名で存在確認（期待: 1 行 = 存在）
SELECT to_regclass('public.soil_call_history_legacy_tree_20260511') AS renamed_table;

-- 元名で不在確認（期待: NULL = 不在 = Soil migration apply 可能）
SELECT to_regclass('public.soil_call_history') AS old_name_should_be_null;

-- データ保持確認（期待: rename 前と同じ行数）
SELECT count(*) AS row_count_after_rename FROM public.soil_call_history_legacy_tree_20260511;

-- ============================================================
-- 次アクション（rename 成功後）
-- ============================================================
-- 1. a-main-023 へ「rename 成功 + 行数 N」報告
-- 2. a-soil-002 (# 294 受領後) が Soil migration 8 件 apply 計画起草
-- 3. 5/12-13 で a-soil + 東海林さん + a-main-023 連携順次 Run
-- 4. Soil migration 8 件 apply 完了後、legacy テーブルのデータ移行検討（a-tree-002 + a-soil-002 協議）
