-- ============================================================
-- Garden Bud — 03_Bank: 銀行口座 + 残高履歴 + 取引履歴
-- ============================================================
-- 対応 dispatch: main- No. 276 急務 Garden 化（D-2 Supabase テーブル設計）
-- 作成: 2026-05-11（a-bud-002、5/12 デモ前 alpha 版）
--
-- 目的:
--   東海林さんの「各銀行サイト目視 → Excel 集計 → 後道さん報告」業務を
--   Garden で自動化。MF API エラー期間中の手作業削減 + Forest 既実装 CSV
--   パーサー連動 + 手入力残高 UI を支える DB スキーマ。
--
-- スコープ（本 migration で対応）:
--   1. bud_bank_accounts（法人 × 銀行 × 口座 マスタ）
--   2. bud_bank_balances（残高履歴、時系列）
--   3. bud_bank_transactions（取引履歴、CSV 取込分）
--   4. RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ
--
-- 含めない:
--   - CSV パーサー実装 → 別 lib（Forest 既実装 import 予定）
--   - Chatwork 通知 → Server Action 別実装
--   - 手入力残高 UI → src/app/bud/bank/_components/
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_bank_accounts（法人 × 銀行 × 口座 マスタ）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_accounts (
  id uuid primary key default gen_random_uuid(),

  -- 法人識別（将来 fruit_companies に FK、本 migration では text で先行起票）
  corp_code text not null
    check (corp_code in (
      'hyuaran',
      'centerrise',
      'linksupport',
      'arata',
      'taiyou',
      'ichi'
    )),

  -- 銀行識別
  bank_code text not null
    check (bank_code in (
      'mizuho',       -- みずほ銀行
      'rakuten',      -- 楽天銀行
      'paypay',       -- PayPay 銀行
      'kyoto'         -- 京都銀行
    )),
  bank_name text not null,

  -- 口座情報
  branch_name text,
  branch_code text
    check (branch_code is null or branch_code ~ '^[0-9]{3}$'),
  account_type text not null
    check (account_type in ('普通', '当座', '貯蓄')),
  account_number text
    check (account_number is null or account_number ~ '^[0-9]+$'),

  -- 状態
  is_active boolean not null default true,
  has_csv_export boolean not null default true,
    -- false: みずほ等 CSV に残高列なし → 手入力で残高補完
  needs_manual_balance boolean not null default false,
    -- true: PayPay 障害等で CSV 取込不能 → 残高のみ手入力

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  unique (corp_code, bank_code, account_number)
);

create index if not exists idx_bba_corp on public.bud_bank_accounts(corp_code) where deleted_at is null;
create index if not exists idx_bba_bank on public.bud_bank_accounts(bank_code) where deleted_at is null;

comment on table public.bud_bank_accounts is
  'Bud 03_Bank 口座マスタ。法人 × 銀行 × 口座、main- No. 276 急務 Garden 化、5/11 6 法人 × 4 銀行 対応';

-- ------------------------------------------------------------
-- 2. bud_bank_balances（残高履歴、時系列）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_balances (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bud_bank_accounts(id),

  -- 残高
  balance_date date not null,
  balance_amount numeric(14, 0) not null,

  -- ソース区分
  source text not null
    check (source in (
      'csv_auto',       -- CSV 取込自動
      'manual_input',   -- 通帳ベース手入力（みずほ・PayPay 障害時等）
      'api_sync'        -- 将来: MF API 復旧後の自動同期
    )),

  -- 入力者（manual_input 時必須）
  input_user_id text references public.root_employees(employee_id),
  source_csv_path text,  -- csv_auto 時のパス記録

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  -- 1 口座 1 日 1 残高（重複防止）
  unique (bank_account_id, balance_date, source)
);

create index if not exists idx_bbb_account_date
  on public.bud_bank_balances(bank_account_id, balance_date desc);

create index if not exists idx_bbb_date
  on public.bud_bank_balances(balance_date desc);

comment on table public.bud_bank_balances is
  'Bud 03_Bank 残高履歴。csv_auto / manual_input / api_sync 区分。手入力時は input_user_id 必須';

-- ------------------------------------------------------------
-- 3. bud_bank_transactions（取引履歴、CSV 取込分）
-- ------------------------------------------------------------
create table if not exists public.bud_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references public.bud_bank_accounts(id),

  -- 取引
  transaction_date date not null,
  amount numeric(14, 0) not null,
  description text,
  balance_after numeric(14, 0),

  -- ソース
  source_csv_path text not null,
  raw_row jsonb not null,  -- 元 CSV 行の完全保持（監査用）

  -- メタ
  imported_at timestamptz not null default now(),
  imported_by text references public.root_employees(employee_id),

  -- 監査用、UPDATE / DELETE 禁止
  notes text
);

create index if not exists idx_bbt_account_date
  on public.bud_bank_transactions(bank_account_id, transaction_date desc);

comment on table public.bud_bank_transactions is
  'Bud 03_Bank 取引履歴。CSV 取込分、raw_row で原文保持、INSERT only';

-- ------------------------------------------------------------
-- 4. RLS: 全員 SELECT、書込は payroll_auditor 以上、論理削除のみ
-- ------------------------------------------------------------

-- 4.1 bud_bank_accounts
alter table public.bud_bank_accounts enable row level security;

drop policy if exists bba_select_all on public.bud_bank_accounts;
create policy bba_select_all on public.bud_bank_accounts
  for select using (deleted_at is null);

drop policy if exists bba_insert_auditor on public.bud_bank_accounts;
create policy bba_insert_auditor on public.bud_bank_accounts
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bba_update_auditor on public.bud_bank_accounts;
create policy bba_update_auditor on public.bud_bank_accounts
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bba_no_delete on public.bud_bank_accounts;
create policy bba_no_delete on public.bud_bank_accounts
  for delete using (false);

-- 4.2 bud_bank_balances
alter table public.bud_bank_balances enable row level security;

drop policy if exists bbb_select_all on public.bud_bank_balances;
create policy bbb_select_all on public.bud_bank_balances
  for select using (true);

drop policy if exists bbb_insert_auditor on public.bud_bank_balances;
create policy bbb_insert_auditor on public.bud_bank_balances
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbb_update_auditor on public.bud_bank_balances;
create policy bbb_update_auditor on public.bud_bank_balances
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbb_no_delete on public.bud_bank_balances;
create policy bbb_no_delete on public.bud_bank_balances
  for delete using (false);

-- 4.3 bud_bank_transactions（INSERT only、UPDATE / DELETE 禁止）
alter table public.bud_bank_transactions enable row level security;

drop policy if exists bbt_select_all on public.bud_bank_transactions;
create policy bbt_select_all on public.bud_bank_transactions
  for select using (true);

drop policy if exists bbt_insert_auditor on public.bud_bank_transactions;
create policy bbt_insert_auditor on public.bud_bank_transactions
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bbt_no_update on public.bud_bank_transactions;
create policy bbt_no_update on public.bud_bank_transactions
  for update using (false);

drop policy if exists bbt_no_delete on public.bud_bank_transactions;
create policy bbt_no_delete on public.bud_bank_transactions
  for delete using (false);

-- ============================================================
-- end of migration 20260511000010
-- ============================================================
