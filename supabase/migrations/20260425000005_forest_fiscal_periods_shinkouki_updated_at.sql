-- ============================================================
-- Garden Forest — fiscal_periods / shinkouki に updated_at 列追加（T-F2-01 補完）
-- ============================================================
-- 対応 PR: #43 (feat(forest): T-F2-01 ヘッダー最終更新日 + T-F3-F8 MacroChart タイトル v9 互換化)
-- 作成: 2026-04-25
--
-- 背景:
--   PR #43 で `fetchLastUpdated()` (src/app/forest/_lib/queries.ts:175) が
--   fiscal_periods.updated_at と shinkouki.updated_at を読み込む実装を merge したが、
--   両テーブルとも初期 schema (scripts/forest-schema.sql) に updated_at 列が存在せず、
--   migration ファイルも未作成だった（=「最終更新日」表示が失敗していた）。
--
-- 本 migration の役割:
--   - 両テーブルに updated_at 列を追加（既存行は now() で初期化）
--   - PR #43 で生成された forest_update_updated_at() trigger 関数を定義
--   - 両テーブルに before update trigger を設定
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   garden-prod への適用は Phase A 全完了後にまとめて。
--
-- 冪等性: add column if not exists / drop trigger if exists / create or replace で
-- 何度実行しても同じ結果になる。
-- ============================================================

-- ------------------------------------------------------------
-- 1. fiscal_periods に updated_at 列追加
-- ------------------------------------------------------------
alter table public.fiscal_periods
  add column if not exists updated_at timestamptz not null default now();

comment on column public.fiscal_periods.updated_at is
  'レコード最終更新時刻。Forest ヘッダーの「最終更新日」表示で参照（PR #43 補完）。';

-- ------------------------------------------------------------
-- 2. shinkouki に updated_at 列追加
-- ------------------------------------------------------------
alter table public.shinkouki
  add column if not exists updated_at timestamptz not null default now();

comment on column public.shinkouki.updated_at is
  'レコード最終更新時刻。Forest ヘッダーの「最終更新日」表示で参照（PR #43 補完）。';

-- ------------------------------------------------------------
-- 3. updated_at 自動更新 trigger 関数（Forest 専用）
--    Root の root_update_updated_at() と同等の汎用関数
-- ------------------------------------------------------------
create or replace function public.forest_update_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.forest_update_updated_at() is
  'Forest テーブル用 updated_at 自動更新 trigger 関数（PR #43 補完）。';

-- ------------------------------------------------------------
-- 4. fiscal_periods に before update trigger 設定
-- ------------------------------------------------------------
drop trigger if exists trg_fiscal_periods_updated_at on public.fiscal_periods;

create trigger trg_fiscal_periods_updated_at
  before update on public.fiscal_periods
  for each row execute function public.forest_update_updated_at();

-- ------------------------------------------------------------
-- 5. shinkouki に before update trigger 設定
-- ------------------------------------------------------------
drop trigger if exists trg_shinkouki_updated_at on public.shinkouki;

create trigger trg_shinkouki_updated_at
  before update on public.shinkouki
  for each row execute function public.forest_update_updated_at();

-- ------------------------------------------------------------
-- 6. 既存行の updated_at を明示的に初期化
--    (default now() で入るはずだが、稀に default が反映されないケースの保険)
-- ------------------------------------------------------------
update public.fiscal_periods set updated_at = now() where updated_at is null;
update public.shinkouki set updated_at = now() where updated_at is null;

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- -- 列確認
-- SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('fiscal_periods', 'shinkouki')
--     AND column_name = 'updated_at';
--
-- -- trigger 確認
-- SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers
--   WHERE trigger_name LIKE 'trg_%_updated_at';
--
-- -- 関数確認
-- SELECT proname FROM pg_proc WHERE proname = 'forest_update_updated_at';
--
-- -- 動作確認（admin で）
-- UPDATE public.shinkouki SET label = label WHERE company_id = 'YOUR_COMPANY_ID';
-- SELECT updated_at FROM public.shinkouki WHERE company_id = 'YOUR_COMPANY_ID';
