-- ============================================================
-- Garden Bud — Phase D #03: 賞与計算（admin only RLS、Cat 4 #28 反映）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md
-- 作成: 2026-05-07（a-bud、main- No.97 GO 受領後 Day 4 前倒し着手）
--
-- 目的:
--   月次給与とは別系統の賞与（夏冬・決算賞与）の計算結果テーブル + 算出率表を定義。
--   Cat 4 #28（賞与処理 admin only）反映済 = INSERT/UPDATE は admin/super_admin のみ。
--
-- スコープ（本 migration で対応）:
--   1. bud_bonus_records（賞与結果、健保上限到達フラグ等含む）
--   2. bud_bonus_withholding_rate_table（賞与算出率表、甲乙別 + 扶養 0-7 人）
--   3. RLS（Cat 4 #28: admin only INSERT/UPDATE、自分閲覧 OK、DELETE 完全禁止）
--
-- 含めない:
--   - 計算本体 → src/app/bud/payroll/_lib/bonus-calculator.ts （純関数）
--   - 賞与時社保計算 → D-05 calculateBonusInsurance（再利用）
--   - 算出率表の初期データ → 国税庁データから別 SQL 投入（admin 作業）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_bonus_records（賞与結果）
-- ------------------------------------------------------------
create table if not exists public.bud_bonus_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  bonus_label text not null check (length(bonus_label) > 0),
  bonus_payment_date date not null,
  employee_id uuid not null references public.root_employees(id),

  -- 支給額
  base_bonus numeric(12, 0) not null check (base_bonus >= 0),
  performance_addition numeric(12, 0) not null default 0
    check (performance_addition >= 0),
  other_additions jsonb,
  gross_bonus numeric(12, 0) not null check (gross_bonus >= 0),

  -- 社保（標準賞与額ベース、D-05 calculateBonusInsurance 結果）
  health_insurance numeric(10, 0) not null default 0 check (health_insurance >= 0),
  welfare_pension numeric(10, 0) not null default 0 check (welfare_pension >= 0),
  long_term_care_insurance numeric(10, 0) not null default 0 check (long_term_care_insurance >= 0),
  employment_insurance numeric(10, 0) not null default 0 check (employment_insurance >= 0),
  total_social_insurance numeric(10, 0) not null default 0 check (total_social_insurance >= 0),

  -- 源泉徴収（算出率表）
  withholding_rate numeric(5, 4) not null check (withholding_rate >= 0 and withholding_rate < 1),
  withholding_tax numeric(10, 0) not null default 0 check (withholding_tax >= 0),

  -- 控除合計・差引支給額
  total_deductions numeric(10, 0) not null check (total_deductions >= 0),
  net_bonus numeric(12, 0) not null,

  -- スナップショット（再現性、計算時点の値固定）
  previous_month_taxable_amount numeric(12, 0) not null
    check (previous_month_taxable_amount >= 0),
  kou_otsu_at_calculation text not null
    check (kou_otsu_at_calculation in ('kou', 'otsu')),
  dependents_count_at_calculation int not null
    check (dependents_count_at_calculation between 0 and 20),
  health_capped boolean not null default false,
  pension_capped boolean not null default false,

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'paid', 'cancelled')),

  -- 監査
  calculated_at timestamptz not null default now(),
  calculated_by uuid references public.root_employees(id),
  approved_at timestamptz,
  approved_by uuid references public.root_employees(id),
  paid_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by uuid references public.root_employees(id),
  deleted_reason text,

  constraint uq_bonus_period_employee
    unique (payroll_period_id, employee_id),
  constraint chk_bonus_net_consistency
    check (net_bonus = gross_bonus - total_deductions)
);

comment on table public.bud_bonus_records is
  '賞与（夏冬・決算）の計算結果。Cat 4 #28 反映: admin のみ INSERT/UPDATE。net_bonus = gross_bonus - total_deductions の整合性 CHECK。';

create index if not exists idx_bud_bonus_period
  on public.bud_bonus_records (payroll_period_id);
create index if not exists idx_bud_bonus_employee_payment
  on public.bud_bonus_records (employee_id, bonus_payment_date desc);
create index if not exists idx_bud_bonus_status
  on public.bud_bonus_records (status);

-- ------------------------------------------------------------
-- 2. bud_bonus_withholding_rate_table（賞与算出率表）
-- ------------------------------------------------------------
-- 国税庁「賞与に対する源泉徴収税額の算出率の表」
-- 前月給与の社会保険料控除後の金額 × 甲乙別 × 扶養人数別
-- 7 人超は dependents_7 の率を流用（実態として変動小）
create table if not exists public.bud_bonus_withholding_rate_table (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  kou_otsu text not null check (kou_otsu in ('kou', 'otsu')),
  previous_month_min numeric(10, 0) not null check (previous_month_min >= 0),
  previous_month_max numeric(10, 0)
    check (previous_month_max is null or previous_month_max > previous_month_min),
  dependents_0 numeric(5, 4) not null check (dependents_0 >= 0 and dependents_0 < 1),
  dependents_1 numeric(5, 4) not null check (dependents_1 >= 0 and dependents_1 < 1),
  dependents_2 numeric(5, 4) not null check (dependents_2 >= 0 and dependents_2 < 1),
  dependents_3 numeric(5, 4) not null check (dependents_3 >= 0 and dependents_3 < 1),
  dependents_4 numeric(5, 4) not null check (dependents_4 >= 0 and dependents_4 < 1),
  dependents_5 numeric(5, 4) not null check (dependents_5 >= 0 and dependents_5 < 1),
  dependents_6 numeric(5, 4) not null check (dependents_6 >= 0 and dependents_6 < 1),
  dependents_7 numeric(5, 4) not null check (dependents_7 >= 0 and dependents_7 < 1),

  constraint uq_bonus_rate
    unique (effective_year, kou_otsu, previous_month_min, previous_month_max)
);

comment on table public.bud_bonus_withholding_rate_table is
  '賞与算出率表。前月給与の社保控除後額の範囲別 × 甲乙 × 扶養 0-7 人。7 人超は dependents_7 率を流用。';

create index if not exists idx_bonus_rate_lookup
  on public.bud_bonus_withholding_rate_table (effective_year, kou_otsu, previous_month_min);

-- ------------------------------------------------------------
-- 3. RLS（Cat 4 #28 反映: 賞与処理 admin only）
-- ------------------------------------------------------------

alter table public.bud_bonus_records enable row level security;
alter table public.bud_bonus_withholding_rate_table enable row level security;

-- ----- bud_bonus_records: 自分閲覧 + payroll_* SELECT、INSERT/UPDATE は admin のみ（Cat 4 #28）-----
drop policy if exists br_select on public.bud_bonus_records;
create policy br_select on public.bud_bonus_records
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

-- Cat 4 #28: 賞与処理 admin only INSERT/UPDATE（給与本体は payroll_calculator も可だが、賞与は admin 限定）
drop policy if exists br_insert_admin_only on public.bud_bonus_records;
create policy br_insert_admin_only on public.bud_bonus_records
  for insert
  with check (public.bud_is_admin_or_super_admin());

-- Cat 4 #28: 自起票禁止（admin が承認する場合は別 admin が必要、給与本体 V6 と同等の原則）
drop policy if exists br_update_admin_only on public.bud_bonus_records;
create policy br_update_admin_only on public.bud_bonus_records
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists br_no_delete on public.bud_bonus_records;
create policy br_no_delete on public.bud_bonus_records
  for delete
  using (false);

-- ----- bud_bonus_withholding_rate_table: payroll_* + admin SELECT、admin のみ書込 -----
drop policy if exists bwr_select on public.bud_bonus_withholding_rate_table;
create policy bwr_select on public.bud_bonus_withholding_rate_table
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists bwr_insert_admin on public.bud_bonus_withholding_rate_table;
create policy bwr_insert_admin on public.bud_bonus_withholding_rate_table
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists bwr_update_admin on public.bud_bonus_withholding_rate_table;
create policy bwr_update_admin on public.bud_bonus_withholding_rate_table
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists bwr_no_delete on public.bud_bonus_withholding_rate_table;
create policy bwr_no_delete on public.bud_bonus_withholding_rate_table
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('bud_bonus_records', 'bud_bonus_withholding_rate_table');
--
-- -- Cat 4 #28 admin only RLS 確認
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
--   WHERE tablename = 'bud_bonus_records'
--   ORDER BY cmd, policyname;
