-- ============================================================
-- Garden Bud → Root: bud_bank_* → root_bank_* テーブル名変更
-- ============================================================
-- 対応 dispatch: main- No. 339 §D（東海林さん 5/11 21:30 GO、α 採用）
-- 作成: 2026-05-13（a-bud-002）
--
-- 目的:
--   銀行 CSV データ蓄積先を Bud から Root へ責任移管。
--   Garden 共通基盤として root_bank_* で命名統一、Bud 以外のモジュール
--   （Forest 等）からも参照可能にする。
--
-- 背景:
--   - bud_bank_accounts / bud_bank_balances / bud_bank_transactions は
--     PR #159 alpha (5/11 morning merged) で create 済、本番 DB 適用済 (5/11 22:07)
--   - dispatch main- No. 339 §D で α 案採用: 「rename のみ、内容変更なし」
--   - UI は /bud/bank/ に残るが、データ実体は root_bank_* 配下に移管
--
-- スコープ（本 migration で対応）:
--   1. bud_bank_accounts → root_bank_accounts （ALTER TABLE RENAME）
--   2. bud_bank_balances → root_bank_balances （同上）
--   3. bud_bank_transactions → root_bank_transactions （同上）
--   4. 関連 index / RLS policy / FK 制約は PostgreSQL が自動追従
--   5. bud_journal_entries.source_bank_transaction_id FK 参照先も自動追従
--
-- 含めない:
--   - bud_bank_* テーブルの内容変更（rename のみ、データ・列・制約・RLS 全件不変）
--   - ソースコード（src/app/bud/bank/_lib/）の参照名更新 → 別 commit で本 PR 内
--   - root モジュール側の責任移管（Phase B-5 候補、別 PR）
--
-- 注意:
--   - 本 migration apply 前に bud_bank_* 3 テーブルが本番 DB に存在することを確認
--   - ALTER TABLE RENAME は metadata 変更のみで data 不変、所要時間ミリ秒オーダー
--   - 本 PR merge 後、a-bud-002 で次 migration / ソースコードで root_bank_* 参照に統一
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_bank_accounts → root_bank_accounts
-- ------------------------------------------------------------
alter table public.bud_bank_accounts rename to root_bank_accounts;

comment on table public.root_bank_accounts is
  'Garden 銀行口座マスタ（旧 bud_bank_accounts、5/13 rename）。法人 × 銀行 × 口座、has_csv_export / needs_manual_balance フラグで CSV 取込分岐管理';

-- ------------------------------------------------------------
-- 2. bud_bank_balances → root_bank_balances
-- ------------------------------------------------------------
alter table public.bud_bank_balances rename to root_bank_balances;

comment on table public.root_bank_balances is
  'Garden 銀行残高履歴（旧 bud_bank_balances、5/13 rename）。csv_auto / manual_input / api_sync 区分';

-- ------------------------------------------------------------
-- 3. bud_bank_transactions → root_bank_transactions
-- ------------------------------------------------------------
alter table public.bud_bank_transactions rename to root_bank_transactions;

comment on table public.root_bank_transactions is
  'Garden 銀行取引履歴（旧 bud_bank_transactions、5/13 rename）。CSV 取込分、raw_row jsonb で原文保持、INSERT only';

-- ------------------------------------------------------------
-- 4. RLS policy 名 / index 名の自動追従 (PostgreSQL 標準動作)
-- ------------------------------------------------------------
-- ALTER TABLE RENAME により、
-- - 既存 RLS policy（bba_*, bbb_*, bbt_*）は新 table 名と連動
-- - 既存 index（idx_bba_*, idx_bbb_*, idx_bbt_*）は table 名連動で自動更新
-- - bud_journal_entries.source_bank_transaction_id FK の参照先テーブルも自動追従
-- → 追加修正不要

-- ------------------------------------------------------------
-- 5. 動作検証 SQL（apply 後手動 Run 推奨）
-- ------------------------------------------------------------
-- ✅ 新テーブル名で SELECT 可
--    select count(*) from public.root_bank_accounts;
--    select count(*) from public.root_bank_balances;
--    select count(*) from public.root_bank_transactions;
-- ✅ 旧テーブル名は relation does not exist で失敗
--    select * from public.bud_bank_accounts;  -- error: relation "bud_bank_accounts" does not exist
-- ✅ bud_journal_entries の FK 参照先確認
--    select conname, confrelid::regclass from pg_constraint
--    where conrelid = 'public.bud_journal_entries'::regclass and contype = 'f';
--    → fk_*_source_bank_transaction が root_bank_transactions を参照していること

-- ============================================================
-- end of migration 20260513000001
-- ============================================================
