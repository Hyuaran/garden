-- ============================================================
-- Garden Bud — Phase D #07: 銀行振込連携（Cat 4 #27 同時出力 + ハイブリッド方式）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md
-- 作成: 2026-05-07（a-bud、main- No.99 GO 受領後 Day 5 前倒し着手）
--
-- 目的:
--   bud_salary_records / bud_bonus_records で確定した給与・賞与を、
--   銀行振込実行（全銀協 FB データ）+ 会計連携（8 大区分階層 CSV）+ MFC CSV（D-11、Cat 4 #27）の
--   3 経路同時出力（exportPayrollBatchHybrid）に対応するためのテーブル定義。
--
-- スコープ（本 migration で対応）:
--   1. bud_payroll_transfer_batches（給与振込バッチ、status 管理）
--   2. bud_payroll_transfer_items（個別明細、振込先スナップショット）
--   3. bud_payroll_accounting_reports（会計連携レポート、8 大区分階層 jsonb）
--   4. RLS（自分閲覧 + payroll_disburser/auditor + admin、admin/payroll_disburser INSERT/UPDATE）
--
-- 含めない:
--   - 計算本体（FB データ生成 / カナ変換 / CSV 生成）→ src/app/bud/payroll/_lib/transfer-* （純関数）
--   - 既存 A-04 連携 → 別 PR で対応想定
--   - 銀行休業日テーブル（root.holidays / bud.bank_holidays）→ Phase E
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_payroll_transfer_batches（給与振込バッチ）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_transfer_batches (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  company_id text not null references public.root_companies(company_id),
  source_bank_account_id uuid not null,                -- bud_company_bank_accounts(id) — 既存 Phase A
  transfer_type text not null
    check (transfer_type in ('salary', 'bonus')),
  scheduled_payment_date date not null,
  total_employees int not null check (total_employees >= 0),
  total_amount numeric(14, 0) not null check (total_amount >= 0),
  fb_data_path text,                                    -- Storage パス（generated 後セット）
  status text not null default 'draft'
    check (status in ('draft', 'approved', 'fb_generated', 'uploaded_to_bank', 'completed', 'failed')),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  fb_generated_at timestamptz,
  bank_uploaded_at timestamptz,
  completed_at timestamptz,
  failed_reason text,
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),

  constraint uq_transfer_batch_per_period_company_type
    unique (payroll_period_id, company_id, transfer_type)
);

comment on table public.bud_payroll_transfer_batches is
  '給与・賞与振込バッチ。1 法人 × 1 期間 × 1 種別（給与/賞与）で一意。Cat 4 #27 同時出力（FB / 会計レポート / MFC CSV）の起点。';

create index if not exists idx_transfer_batches_status
  on public.bud_payroll_transfer_batches (status, scheduled_payment_date);
create index if not exists idx_transfer_batches_period
  on public.bud_payroll_transfer_batches (payroll_period_id, transfer_type);

-- ------------------------------------------------------------
-- 2. bud_payroll_transfer_items（個別明細）
-- ------------------------------------------------------------
create table if not exists public.bud_payroll_transfer_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bud_payroll_transfer_batches(id) on delete cascade,
  salary_record_id uuid references public.bud_salary_records(id),
  bonus_record_id uuid references public.bud_bonus_records(id),
  employee_id text not null references public.root_employees(employee_id),

  -- 振込情報スナップショット（A-04 連携用、口座変更時の再現性保証）
  recipient_bank_code text not null check (recipient_bank_code ~ '^[0-9]{4}$'),
  recipient_branch_code text not null check (recipient_branch_code ~ '^[0-9]{3}$'),
  recipient_account_type text not null
    check (recipient_account_type in ('普通', '当座', '貯蓄')),
  recipient_account_number text not null
    check (recipient_account_number ~ '^[0-9]+$' and length(recipient_account_number) between 1 and 8),
  recipient_account_holder text not null,             -- 半角カナ

  transfer_amount numeric(12, 0) not null check (transfer_amount >= 0),

  bud_furikomi_id uuid,                               -- A-04 連携用（既存 bud_furikomi）
  fb_record_no int,                                   -- FB データ内の連番

  item_status text not null default 'pending'
    check (item_status in ('pending', 'submitted', 'completed', 'failed', 'rejected')),
  failed_reason text,

  -- salary_record_id / bonus_record_id は排他（XOR）
  constraint chk_salary_or_bonus
    check (
      (salary_record_id is not null and bonus_record_id is null)
      or (salary_record_id is null and bonus_record_id is not null)
    )
);

comment on table public.bud_payroll_transfer_items is
  '振込明細。1 batch × 1 employee = 1 行。salary_record_id と bonus_record_id は排他。振込先情報をスナップショット保存。';

create index if not exists idx_transfer_items_batch
  on public.bud_payroll_transfer_items (batch_id);
create index if not exists idx_transfer_items_employee
  on public.bud_payroll_transfer_items (employee_id, item_status);

-- ------------------------------------------------------------
-- 3. bud_payroll_accounting_reports（会計連携レポート、8 大区分階層）
-- ------------------------------------------------------------
-- 4 次 follow-up で 5 区分フラット → 8 大区分階層構造に拡張済み。
-- category_hierarchy jsonb に items[] / subtotal / is_future_use の階層構造で保持。
create table if not exists public.bud_payroll_accounting_reports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.bud_payroll_transfer_batches(id) on delete cascade,

  -- 出力ファイル情報
  report_csv_storage_path text not null,
  report_csv_filename text not null,
  report_csv_size_bytes int not null check (report_csv_size_bytes > 0),
  report_csv_checksum text not null,                  -- SHA256

  -- 集計（メタ情報）
  total_employees int not null check (total_employees >= 0),
  total_amount numeric(14, 0) not null check (total_amount >= 0),

  -- 8 大区分階層（jsonb）
  -- 構造: {
  --   "役員報酬": { "items": [{name, amount}, ...], "subtotal": N, "is_future_use": false },
  --   "給与": {...},
  --   "賞与": {...},        -- 月次は通常 is_future_use=true
  --   "交通費": {...},
  --   "会社負担社保等": {...},
  --   "外注費": {...},
  --   "販売促進費": {...},
  --   "固定費等": {...}
  -- }
  category_hierarchy jsonb not null,

  -- メタ
  generated_at timestamptz not null default now(),
  generated_by text not null references public.root_employees(employee_id),
  downloaded_at timestamptz,
  downloaded_by text references public.root_employees(employee_id),
  imported_to_mf_at timestamptz,                      -- 東海林さん admin が MFC 会計取込確認後手動更新
  imported_to_mf_by text references public.root_employees(employee_id),
  shared_with_godo_at timestamptz,                    -- 後道さんへ共有時刻（参照系、Garden 上の確認フローには不在）
  shared_with_godo_by text references public.root_employees(employee_id),

  notes text,

  constraint uq_accounting_report_per_batch
    unique (batch_id)
);

comment on table public.bud_payroll_accounting_reports is
  '会計連携レポート（マネーフォワードクラウド会計取込用）。8 大区分階層 jsonb 構造。Cat 4 #27 で振込ファイル生成と同時生成。';

create index if not exists idx_accounting_reports_batch
  on public.bud_payroll_accounting_reports (batch_id);

-- ------------------------------------------------------------
-- 4. RLS（D-09 helpers 利用）
-- ------------------------------------------------------------

alter table public.bud_payroll_transfer_batches enable row level security;
alter table public.bud_payroll_transfer_items enable row level security;
alter table public.bud_payroll_accounting_reports enable row level security;

-- ----- bud_payroll_transfer_batches: payroll_disburser / auditor / admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists tb_select on public.bud_payroll_transfer_batches;
create policy tb_select on public.bud_payroll_transfer_batches
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_insert on public.bud_payroll_transfer_batches;
create policy tb_insert on public.bud_payroll_transfer_batches
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_update on public.bud_payroll_transfer_batches;
create policy tb_update on public.bud_payroll_transfer_batches
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists tb_no_delete on public.bud_payroll_transfer_batches;
create policy tb_no_delete on public.bud_payroll_transfer_batches
  for delete
  using (false);

-- ----- bud_payroll_transfer_items: 自分閲覧 + payroll_* + admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists ti_select on public.bud_payroll_transfer_items;
create policy ti_select on public.bud_payroll_transfer_items
  for select
  using (
    employee_id = (select employee_id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_insert on public.bud_payroll_transfer_items;
create policy ti_insert on public.bud_payroll_transfer_items
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_update on public.bud_payroll_transfer_items;
create policy ti_update on public.bud_payroll_transfer_items
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ti_no_delete on public.bud_payroll_transfer_items;
create policy ti_no_delete on public.bud_payroll_transfer_items
  for delete
  using (false);

-- ----- bud_payroll_accounting_reports: payroll_* + admin SELECT、payroll_disburser + admin 書込 -----
drop policy if exists ar_select on public.bud_payroll_accounting_reports;
create policy ar_select on public.bud_payroll_accounting_reports
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_insert on public.bud_payroll_accounting_reports;
create policy ar_insert on public.bud_payroll_accounting_reports
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_disburser'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_update on public.bud_payroll_accounting_reports;
create policy ar_update on public.bud_payroll_accounting_reports
  for update
  using (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_disburser', 'payroll_auditor'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ar_no_delete on public.bud_payroll_accounting_reports;
create policy ar_no_delete on public.bud_payroll_accounting_reports
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_payroll_transfer_batches',
--       'bud_payroll_transfer_items',
--       'bud_payroll_accounting_reports'
--     );
