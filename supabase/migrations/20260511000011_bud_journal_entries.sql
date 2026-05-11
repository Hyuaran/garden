-- ============================================================
-- Garden Bud — 07_Shiwakechou: 仕訳帳 + 勘定科目マスタ + 弥生 export 履歴
-- ============================================================
-- 対応 dispatch: main- No. 277（決算急務 Garden 化、# 276 Bank の上位仕訳化レイヤー）
-- 作成: 2026-05-11（a-bud-002、5/12 後段 alpha 版）
--
-- 目的:
--   Forest 配置だった仕訳帳機能を本来配置の Bud へ移管。
--   # 276 Bank の bud_bank_transactions を上位ロジックで仕訳化、
--   弥生会計形式 CSV export までを Garden 内で完結。
--
-- スコープ（本 migration で対応）:
--   1. bud_journal_accounts（勘定科目マスタ、弥生体系準拠）
--   2. bud_journal_entries（仕訳帳本体、bud_bank_transactions FK）
--   3. bud_journal_export_logs（弥生 export 履歴）
--   4. RLS: 全員 SELECT、書込 payroll_auditor+、論理削除のみ
--
-- 含めない:
--   - 弥生 CSV エンコーダー → src/app/bud/shiwakechou/_lib/
--   - 勘定科目自動判定ルールエンジン → 後続段階
--   - Forest 既存 CSV パーサー → shared lib 化（# 276 と統合）
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_journal_accounts（勘定科目マスタ、弥生体系準拠）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_accounts (
  id uuid primary key default gen_random_uuid(),

  -- 弥生形式
  account_code text not null,                          -- 例: '111' 普通預金
  account_name text not null,                          -- 例: '普通預金'

  -- 分類
  account_category text not null
    check (account_category in (
      'asset',           -- 資産
      'liability',       -- 負債
      'equity',          -- 純資産
      'revenue',         -- 収益
      'expense',         -- 費用
      'other'
    )),

  -- 表示順 / 状態
  display_order int not null default 999,
  is_active boolean not null default true,
  notes text,

  -- メタ
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  unique (account_code)
);

create index if not exists idx_bja_code
  on public.bud_journal_accounts(account_code) where deleted_at is null;
create index if not exists idx_bja_category
  on public.bud_journal_accounts(account_category) where deleted_at is null;

comment on table public.bud_journal_accounts is
  'Bud 07_Shiwakechou 勘定科目マスタ。弥生会計体系準拠、main- No. 277';

-- ------------------------------------------------------------
-- 2. bud_journal_entries（仕訳帳本体）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_entries (
  id uuid primary key default gen_random_uuid(),

  -- 仕訳日付
  entry_date date not null,

  -- 借方 / 貸方
  debit_account_code text not null,
  credit_account_code text not null,
  amount numeric(14, 0) not null
    check (amount > 0),

  -- 摘要 / 補助情報
  description text,
  memo text,

  -- ソース区分
  source text not null
    check (source in (
      'csv_auto',           -- 銀行取引履歴から自動生成
      'manual_input',       -- 手動入力
      'expense_claim',      -- 経費精算連動
      'payroll',            -- 給与計算連動
      'other'
    )),

  -- # 276 Bank との連動（銀行取引履歴 → 仕訳化）
  source_bank_transaction_id uuid references public.bud_bank_transactions(id),

  -- ライフサイクル
  status text not null default 'pending'
    check (status in (
      'pending',            -- 自動生成、確認待ち
      'confirmed',          -- 確認済（東海林さん承認）
      'exported',           -- 弥生 export 済
      'cancelled'           -- 取消
    )),

  -- 確認 / export メタ
  confirmed_at timestamptz,
  confirmed_by text references public.root_employees(employee_id),
  exported_at timestamptz,
  export_log_id uuid,                                  -- bud_journal_export_logs FK（後で追加）

  cancelled_at timestamptz,
  cancelled_by text references public.root_employees(employee_id),
  cancelled_reason text,

  -- メタ
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  -- 借方 ≠ 貸方
  constraint chk_bje_debit_credit_different
    check (debit_account_code <> credit_account_code)
);

create index if not exists idx_bje_entry_date
  on public.bud_journal_entries(entry_date desc) where deleted_at is null;
create index if not exists idx_bje_status
  on public.bud_journal_entries(status) where deleted_at is null;
create index if not exists idx_bje_source_bank
  on public.bud_journal_entries(source_bank_transaction_id)
  where source_bank_transaction_id is not null;
create index if not exists idx_bje_debit_acc
  on public.bud_journal_entries(debit_account_code) where deleted_at is null;
create index if not exists idx_bje_credit_acc
  on public.bud_journal_entries(credit_account_code) where deleted_at is null;

comment on table public.bud_journal_entries is
  'Bud 07_Shiwakechou 仕訳帳本体。# 276 Bank の bud_bank_transactions から仕訳化、弥生 export 対象';

-- ------------------------------------------------------------
-- 3. bud_journal_export_logs（弥生 export 履歴）
-- ------------------------------------------------------------
create table if not exists public.bud_journal_export_logs (
  id uuid primary key default gen_random_uuid(),

  -- export 対象範囲
  date_from date not null,
  date_to date not null,
  entry_count int not null check (entry_count >= 0),
  total_debit numeric(14, 0) not null,
  total_credit numeric(14, 0) not null,

  -- export 物
  format text not null
    check (format in ('yayoi_csv', 'yayoi_csv_v2', 'freee_csv')),
  file_name text not null,
  file_sha256 text,                                    -- 改ざん検知
  file_size_bytes int,

  -- ストレージパス（Supabase Storage or Vercel Blob）
  storage_path text,

  -- export 実行者
  exported_at timestamptz not null default now(),
  exported_by text references public.root_employees(employee_id),

  -- メモ
  notes text,

  constraint chk_bjel_date_range
    check (date_to >= date_from),
  constraint chk_bjel_debit_credit_balanced
    check (total_debit = total_credit)
);

create index if not exists idx_bjel_exported_at
  on public.bud_journal_export_logs(exported_at desc);

comment on table public.bud_journal_export_logs is
  'Bud 07_Shiwakechou 弥生 export 履歴。INSERT only、SHA256 改ざん検知、借方=貸方 CHECK';

-- export_log_id FK 追加（循環参照回避のため後付け）
alter table public.bud_journal_entries
  add constraint fk_bje_export_log
  foreign key (export_log_id) references public.bud_journal_export_logs(id);

-- ------------------------------------------------------------
-- 4. RLS: 全員 SELECT、書込 payroll_auditor+、論理削除のみ
-- ------------------------------------------------------------

-- 4.1 bud_journal_accounts
alter table public.bud_journal_accounts enable row level security;

drop policy if exists bja_select_all on public.bud_journal_accounts;
create policy bja_select_all on public.bud_journal_accounts
  for select using (deleted_at is null);

drop policy if exists bja_insert_admin on public.bud_journal_accounts;
create policy bja_insert_admin on public.bud_journal_accounts
  for insert with check (
    public.bud_is_admin_or_super_admin()
  );

drop policy if exists bja_update_admin on public.bud_journal_accounts;
create policy bja_update_admin on public.bud_journal_accounts
  for update using (public.bud_is_admin_or_super_admin())
    with check (public.bud_is_admin_or_super_admin());

drop policy if exists bja_no_delete on public.bud_journal_accounts;
create policy bja_no_delete on public.bud_journal_accounts
  for delete using (false);

-- 4.2 bud_journal_entries
alter table public.bud_journal_entries enable row level security;

drop policy if exists bje_select_all on public.bud_journal_entries;
create policy bje_select_all on public.bud_journal_entries
  for select using (deleted_at is null);

drop policy if exists bje_insert_auditor on public.bud_journal_entries;
create policy bje_insert_auditor on public.bud_journal_entries
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bje_update_auditor on public.bud_journal_entries;
create policy bje_update_auditor on public.bud_journal_entries
  for update using (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bje_no_delete on public.bud_journal_entries;
create policy bje_no_delete on public.bud_journal_entries
  for delete using (false);

-- 4.3 bud_journal_export_logs（INSERT only）
alter table public.bud_journal_export_logs enable row level security;

drop policy if exists bjel_select_all on public.bud_journal_export_logs;
create policy bjel_select_all on public.bud_journal_export_logs
  for select using (true);

drop policy if exists bjel_insert_auditor on public.bud_journal_export_logs;
create policy bjel_insert_auditor on public.bud_journal_export_logs
  for insert with check (
    public.bud_has_payroll_role(array['payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bjel_no_update on public.bud_journal_export_logs;
create policy bjel_no_update on public.bud_journal_export_logs
  for update using (false);

drop policy if exists bjel_no_delete on public.bud_journal_export_logs;
create policy bjel_no_delete on public.bud_journal_export_logs
  for delete using (false);

-- ============================================================
-- end of migration 20260511000011
-- ============================================================
