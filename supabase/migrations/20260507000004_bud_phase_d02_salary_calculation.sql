-- ============================================================
-- Garden Bud — Phase D #02: 給与計算ロジック（実装着手版）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md
-- 作成: 2026-05-07（a-bud、main- No.94 GO 受領後 Day 3 前倒し着手）
--
-- 目的:
--   月次給与の支給額・控除額・差引支給額を確定するための結果テーブルとマスタ
--   （個別手当 / 控除上書き / 月額表 甲乙 / 住民税）を定義。計算ロジックは
--   src/app/bud/payroll/_lib/salary-calculator.ts （純関数）で実装。
--
-- スコープ（本 migration で対応）:
--   1. bud_salary_records（給与結果、1 employee × 1 period = 1 行）
--   2. bud_employee_allowances（個別手当上書き）
--   3. bud_employee_deductions（個別控除上書き）
--   4. bud_withholding_tax_table_kou（源泉徴収月額表 甲欄）
--   5. bud_withholding_tax_table_otsu（源泉徴収月額表 乙欄）
--   6. bud_resident_tax_assignments（住民税、6 月のみ別額）
--   7. RLS（自分閲覧 + payroll_* + admin、UPDATE は payroll_calculator + admin、DELETE 完全禁止）
--
-- 含めない:
--   - 計算本体ロジック → src/app/bud/payroll/_lib/salary-calculator.ts
--   - 月額表・住民税の初期データ → 国税庁 / 各市町村データから別 SQL 投入（admin 作業）
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_salary_records（給与結果）
-- ------------------------------------------------------------
create table if not exists public.bud_salary_records (
  id uuid primary key default gen_random_uuid(),
  payroll_period_id uuid not null references public.bud_payroll_periods(id),
  employee_id text not null references public.root_employees(employee_id),

  -- 基本給
  basic_pay numeric(12, 0) not null default 0
    check (basic_pay >= 0),
  hourly_rate numeric(12, 2)
    check (hourly_rate is null or hourly_rate >= 0),
  base_calculation_method text not null
    check (base_calculation_method in ('monthly', 'hourly', 'commission')),

  -- 割増（円）
  overtime_pay numeric(12, 0) not null default 0 check (overtime_pay >= 0),
  late_night_pay numeric(12, 0) not null default 0 check (late_night_pay >= 0),
  holiday_pay numeric(12, 0) not null default 0 check (holiday_pay >= 0),
  legal_overtime_pay numeric(12, 0) not null default 0 check (legal_overtime_pay >= 0),

  -- 手当
  commute_allowance numeric(12, 0) not null default 0 check (commute_allowance >= 0),
  housing_allowance numeric(12, 0) not null default 0 check (housing_allowance >= 0),
  position_allowance numeric(12, 0) not null default 0 check (position_allowance >= 0),
  family_allowance numeric(12, 0) not null default 0 check (family_allowance >= 0),
  qualification_allowance numeric(12, 0) not null default 0 check (qualification_allowance >= 0),
  other_allowances jsonb,
  total_allowances numeric(12, 0) not null default 0 check (total_allowances >= 0),

  -- 欠勤・遅刻控除
  absent_deduction numeric(12, 0) not null default 0 check (absent_deduction >= 0),
  late_deduction numeric(12, 0) not null default 0 check (late_deduction >= 0),
  early_leave_deduction numeric(12, 0) not null default 0 check (early_leave_deduction >= 0),

  -- 総支給額
  gross_pay numeric(12, 0) not null check (gross_pay >= 0),

  -- 社保（D-05 が書込 / 本 spec は読み取り）
  health_insurance numeric(10, 0) not null default 0 check (health_insurance >= 0),
  welfare_pension numeric(10, 0) not null default 0 check (welfare_pension >= 0),
  long_term_care_insurance numeric(10, 0) not null default 0 check (long_term_care_insurance >= 0),
  employment_insurance numeric(10, 0) not null default 0 check (employment_insurance >= 0),
  total_social_insurance numeric(10, 0) not null default 0 check (total_social_insurance >= 0),

  -- 税金
  withholding_tax numeric(10, 0) not null default 0 check (withholding_tax >= 0),
  resident_tax numeric(10, 0) not null default 0 check (resident_tax >= 0),

  -- その他控除
  other_deductions jsonb,
  total_other_deductions numeric(10, 0) not null default 0 check (total_other_deductions >= 0),

  -- 控除合計・差引支給額
  total_deductions numeric(12, 0) not null check (total_deductions >= 0),
  net_pay numeric(12, 0) not null,

  -- 計算メタデータ
  kou_otsu_at_calculation text not null check (kou_otsu_at_calculation in ('kou', 'otsu')),
  dependents_count_at_calculation int not null check (dependents_count_at_calculation between 0 and 20),
  social_insurance_grade int,
  calculation_warnings jsonb,

  -- 状態
  status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'paid', 'cancelled')),

  -- 監査
  calculated_at timestamptz not null default now(),
  calculated_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  approved_by text references public.root_employees(employee_id),
  paid_at timestamptz,

  -- 削除（横断統一）
  deleted_at timestamptz,
  deleted_by text references public.root_employees(employee_id),
  deleted_reason text,

  constraint uq_salary_records_period_employee
    unique (payroll_period_id, employee_id),
  constraint chk_net_pay_consistency
    check (net_pay = gross_pay - total_deductions)
);

comment on table public.bud_salary_records is
  '月次給与の計算結果。1 employee × 1 period = 1 行、UNIQUE 保証。net_pay = gross_pay - total_deductions の整合性 CHECK。';

create index if not exists idx_bud_salary_period
  on public.bud_salary_records (payroll_period_id);
create index if not exists idx_bud_salary_employee_calc
  on public.bud_salary_records (employee_id, calculated_at desc);
create index if not exists idx_bud_salary_status
  on public.bud_salary_records (status);

-- ------------------------------------------------------------
-- 2. bud_employee_allowances（個別手当上書き）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_allowances (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  allowance_type text not null
    check (allowance_type in ('commute', 'housing', 'position', 'family', 'qualification', 'custom')),
  custom_label text,                              -- allowance_type='custom' 時のみ必須
  amount numeric(12, 0) not null check (amount >= 0),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  constraint chk_custom_label_when_custom
    check (
      (allowance_type = 'custom' and custom_label is not null and length(custom_label) > 0)
      or (allowance_type <> 'custom' and custom_label is null)
    )
);

comment on table public.bud_employee_allowances is
  '個別手当上書き。allowance_type=custom 時のみ custom_label 必須。effective_from/to で期間管理。';

create index if not exists idx_bud_emp_allowances_employee
  on public.bud_employee_allowances (employee_id, effective_from desc);

-- ------------------------------------------------------------
-- 3. bud_employee_deductions（個別控除上書き）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  deduction_label text not null check (length(deduction_label) > 0),
  amount numeric(10, 0) not null check (amount >= 0),
  effective_from date not null,
  effective_to date check (effective_to is null or effective_to >= effective_from),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id)
);

comment on table public.bud_employee_deductions is
  '個別控除上書き（親睦会費 / 社員旅行積立等）。期間管理。';

create index if not exists idx_bud_emp_deductions_employee
  on public.bud_employee_deductions (employee_id, effective_from desc);

-- ------------------------------------------------------------
-- 4. bud_withholding_tax_table_kou（源泉徴収月額表 甲欄）
-- ------------------------------------------------------------
-- 国税庁「給与所得の源泉徴収税額表」月額表 甲欄
-- 課税対象額（社保控除後）の範囲別 × 扶養親族数別（0-7 人）
-- 7 人超は dependents_7 から所定額（1,610 円）× 超過人数 を減算
create table if not exists public.bud_withholding_tax_table_kou (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  taxable_min numeric(10, 0) not null check (taxable_min >= 0),
  taxable_max numeric(10, 0) not null check (taxable_max > taxable_min),
  dependents_0 numeric(8, 0) not null check (dependents_0 >= 0),
  dependents_1 numeric(8, 0) not null check (dependents_1 >= 0),
  dependents_2 numeric(8, 0) not null check (dependents_2 >= 0),
  dependents_3 numeric(8, 0) not null check (dependents_3 >= 0),
  dependents_4 numeric(8, 0) not null check (dependents_4 >= 0),
  dependents_5 numeric(8, 0) not null check (dependents_5 >= 0),
  dependents_6 numeric(8, 0) not null check (dependents_6 >= 0),
  dependents_7 numeric(8, 0) not null check (dependents_7 >= 0),

  constraint uq_kou_year_range
    unique (effective_year, taxable_min, taxable_max)
);

comment on table public.bud_withholding_tax_table_kou is
  '源泉徴収月額表 甲欄。課税対象額の範囲別 × 扶養 0-7 人。7 人超は呼び出し側で 1,610 円 × 超過人数を減算。';

create index if not exists idx_kou_lookup
  on public.bud_withholding_tax_table_kou (effective_year, taxable_min);

-- ------------------------------------------------------------
-- 5. bud_withholding_tax_table_otsu（源泉徴収月額表 乙欄）
-- ------------------------------------------------------------
-- 乙欄: 一律高税率、扶養関係なし
-- 税額 = flat_amount + (taxable_amount - taxable_min) × tax_rate
create table if not exists public.bud_withholding_tax_table_otsu (
  id uuid primary key default gen_random_uuid(),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  taxable_min numeric(10, 0) not null check (taxable_min >= 0),
  taxable_max numeric(10, 0) not null check (taxable_max > taxable_min),
  tax_rate numeric(5, 4) not null
    check (tax_rate >= 0 and tax_rate <= 1),
  flat_amount numeric(8, 0) not null default 0 check (flat_amount >= 0),

  constraint uq_otsu_year_range
    unique (effective_year, taxable_min, taxable_max)
);

comment on table public.bud_withholding_tax_table_otsu is
  '源泉徴収月額表 乙欄。flat_amount + (taxable_amount - taxable_min) × tax_rate で税額算出。';

create index if not exists idx_otsu_lookup
  on public.bud_withholding_tax_table_otsu (effective_year, taxable_min);

-- ------------------------------------------------------------
-- 6. bud_resident_tax_assignments（住民税、6 月のみ別額）
-- ------------------------------------------------------------
create table if not exists public.bud_resident_tax_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  fiscal_year int not null
    check (fiscal_year between 2020 and 2099),         -- 6 月-翌 5 月の年度
  june_amount numeric(10, 0) not null check (june_amount >= 0),
  monthly_amount numeric(10, 0) not null check (monthly_amount >= 0),  -- 7 月-翌 5 月共通
  source_municipality text,
  notes text,
  created_at timestamptz not null default now(),

  constraint uq_resident_tax_employee_year
    unique (employee_id, fiscal_year)
);

comment on table public.bud_resident_tax_assignments is
  '住民税の特別徴収額。fiscal_year は 6 月-翌 5 月、6 月のみ別額（端数調整）、7 月-翌 5 月は monthly_amount。';

create index if not exists idx_resident_tax_employee
  on public.bud_resident_tax_assignments (employee_id, fiscal_year desc);

-- ------------------------------------------------------------
-- 7. RLS（D-09 で定義済み helpers 利用）
-- ------------------------------------------------------------

alter table public.bud_salary_records enable row level security;
alter table public.bud_employee_allowances enable row level security;
alter table public.bud_employee_deductions enable row level security;
alter table public.bud_withholding_tax_table_kou enable row level security;
alter table public.bud_withholding_tax_table_otsu enable row level security;
alter table public.bud_resident_tax_assignments enable row level security;

-- ----- bud_salary_records: 自分閲覧 + payroll_* + admin、INSERT は payroll_calculator + admin -----
drop policy if exists sr_select on public.bud_salary_records;
create policy sr_select on public.bud_salary_records
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_insert on public.bud_salary_records;
create policy sr_insert on public.bud_salary_records
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_update on public.bud_salary_records;
create policy sr_update on public.bud_salary_records
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator', 'payroll_approver'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists sr_no_delete on public.bud_salary_records;
create policy sr_no_delete on public.bud_salary_records
  for delete
  using (false);

-- ----- bud_employee_allowances / deductions: 自分閲覧 + payroll_* + admin、書込は payroll_calculator + admin -----
drop policy if exists ea_select on public.bud_employee_allowances;
create policy ea_select on public.bud_employee_allowances
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_write on public.bud_employee_allowances;
create policy ea_write on public.bud_employee_allowances
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_update on public.bud_employee_allowances;
create policy ea_update on public.bud_employee_allowances
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ea_no_delete on public.bud_employee_allowances;
create policy ea_no_delete on public.bud_employee_allowances
  for delete
  using (false);

drop policy if exists ed_select on public.bud_employee_deductions;
create policy ed_select on public.bud_employee_deductions
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_write on public.bud_employee_deductions;
create policy ed_write on public.bud_employee_deductions
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_update on public.bud_employee_deductions;
create policy ed_update on public.bud_employee_deductions
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ed_no_delete on public.bud_employee_deductions;
create policy ed_no_delete on public.bud_employee_deductions
  for delete
  using (false);

-- ----- 月額表 甲乙: payroll_* 全員 SELECT、admin のみ書込 -----
drop policy if exists kou_select on public.bud_withholding_tax_table_kou;
create policy kou_select on public.bud_withholding_tax_table_kou
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists kou_write on public.bud_withholding_tax_table_kou;
create policy kou_write on public.bud_withholding_tax_table_kou
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists kou_update on public.bud_withholding_tax_table_kou;
create policy kou_update on public.bud_withholding_tax_table_kou
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists kou_no_delete on public.bud_withholding_tax_table_kou;
create policy kou_no_delete on public.bud_withholding_tax_table_kou
  for delete
  using (false);

drop policy if exists otsu_select on public.bud_withholding_tax_table_otsu;
create policy otsu_select on public.bud_withholding_tax_table_otsu
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists otsu_write on public.bud_withholding_tax_table_otsu;
create policy otsu_write on public.bud_withholding_tax_table_otsu
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists otsu_update on public.bud_withholding_tax_table_otsu;
create policy otsu_update on public.bud_withholding_tax_table_otsu
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists otsu_no_delete on public.bud_withholding_tax_table_otsu;
create policy otsu_no_delete on public.bud_withholding_tax_table_otsu
  for delete
  using (false);

-- ----- 住民税: 自分閲覧 + payroll_* + admin、admin のみ書込 -----
drop policy if exists rt_select on public.bud_resident_tax_assignments;
create policy rt_select on public.bud_resident_tax_assignments
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rt_write on public.bud_resident_tax_assignments;
create policy rt_write on public.bud_resident_tax_assignments
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rt_update on public.bud_resident_tax_assignments;
create policy rt_update on public.bud_resident_tax_assignments
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rt_no_delete on public.bud_resident_tax_assignments;
create policy rt_no_delete on public.bud_resident_tax_assignments
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_salary_records',
--       'bud_employee_allowances',
--       'bud_employee_deductions',
--       'bud_withholding_tax_table_kou',
--       'bud_withholding_tax_table_otsu',
--       'bud_resident_tax_assignments'
--     );
