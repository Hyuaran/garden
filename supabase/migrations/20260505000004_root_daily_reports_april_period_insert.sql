-- ============================================================
-- Garden Root — 4 月初旬期間集計レコード insert（Phase 1a 補完）
-- ============================================================
-- 対応 dispatch: 2026-05-05(火) 19:07 a-main-012 main- No. 55
-- 作成: 2026-05-05（Bloom 開発進捗ページ Phase 1a 補完、state.txt 自動化以前）
--
-- 目的:
--   state.txt 自動化（4/16 開始）以前の 4/1〜4/12 の作業内容を
--   期間集計レコードとして root_daily_reports / root_daily_report_logs
--   に手動 insert する。粒度はざっくり、詳細追加は post-デモで OK。
--
-- 設計判断（dispatch 仕様より）:
--   - 期間レコードの date 表現:    期間最終日（4/5、4/12）を代表日とする
--   - source 列:                    'manual-summary'（state.txt sync 由来と区別）
--   - workstyle / is_irregular:     NULL（期間集計のため特定日の勤務形態は不明）
--   - content 表現:                 末尾に `（X/Y〜X/Z の作業まとめ）` を含める
--   - module 抽出:                  Forest / Tree（dispatch §insert データ参照）
--
-- 冪等性:
--   - root_daily_reports は ON CONFLICT DO UPDATE で再実行可
--   - root_daily_report_logs は report_date で DELETE → INSERT で重複防止
--
-- 関連:
--   - 前提 migration: 20260505000001 / 20260505000002（テーブル本体）
--   - 4/13〜4/15 は提供なしのため insert 対象外（東海林さん再提供あれば追加 dispatch）
--   - 4/16〜現在は state.txt 自動取込（main- No. 53 の import-state-to-root.ts）
--
-- 適用方法:
--   Supabase Dashboard > SQL Editor で本ファイルの内容を貼付し Run。
--   先に 20260505000001 / 20260505000002 を適用済みであること。
-- ============================================================

-- ------------------------------------------------------------
-- 期間 1: 4/1〜4/5（Garden Forest 前段階）
-- 期間 2: 4/6〜4/12（Garden Tree UI / 仕組み）
-- 各期間の最終日を代表 date として 1 ヘッダー + 1 ログを格納
-- ------------------------------------------------------------

-- 1) ヘッダー upsert
insert into public.root_daily_reports (date, workstyle, is_irregular, irregular_label, source)
values
  ('2026-04-05', null, false, null, 'manual-summary'),
  ('2026-04-12', null, false, null, 'manual-summary')
on conflict (date) do update set
  source     = excluded.source,
  updated_at = now();

-- 2) ログは冪等性のため DELETE → INSERT（再実行しても重複しない）
delete from public.root_daily_report_logs
  where report_date in ('2026-04-05', '2026-04-12');

insert into public.root_daily_report_logs (report_date, category, module, content, ord)
values
  ('2026-04-05', 'work', 'Forest', '前段階として仕分け帳の仕組みを自動化（4/1〜4/5 の作業まとめ）', 0),
  ('2026-04-12', 'work', 'Tree',   'UI や仕組み等を作成（4/6〜4/12 の作業まとめ）', 0);

-- ------------------------------------------------------------
-- ⚠️ source 列の CHECK 制約について
-- ------------------------------------------------------------
-- 20260505000001 で root_daily_reports.source は
--   CHECK (source IN ('state.txt', 'manual', 'reconstructed'))
-- と定義されている。本 dispatch で指定された 'manual-summary' は
-- 既存 CHECK 制約に含まれていないため、CHECK 制約を拡張する。
--
-- 既存値との整合:
--   - 'state.txt'         → state.txt 自動 sync 由来（既存）
--   - 'manual'            → 東海林さん手動 INSERT（既存、本 dispatch では未使用）
--   - 'reconstructed'     → send_log.txt から再構築（既存、import script で使用）
--   - 'manual-summary'    → 期間集計手動 INSERT（本 dispatch で追加）
-- ------------------------------------------------------------

alter table public.root_daily_reports
  drop constraint if exists root_daily_reports_source_check;

alter table public.root_daily_reports
  add constraint root_daily_reports_source_check
  check (source in ('state.txt', 'manual', 'reconstructed', 'manual-summary'));

-- ------------------------------------------------------------
-- 確認クエリ（手動実行用）
-- ------------------------------------------------------------
-- SELECT date, source, updated_at FROM public.root_daily_reports
--   WHERE date IN ('2026-04-05', '2026-04-12');
-- 期待: 2 行 (source='manual-summary')

-- SELECT report_date, category, module, content, ord FROM public.root_daily_report_logs
--   WHERE report_date IN ('2026-04-05', '2026-04-12') ORDER BY report_date, ord;
-- 期待: 2 行
--   2026-04-05 / work / Forest / 前段階として仕分け帳... / 0
--   2026-04-12 / work / Tree   / UI や仕組み等を作成...   / 0

-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conname = 'root_daily_reports_source_check';
-- 期待: 4 値の CHECK
