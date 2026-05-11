-- ============================================================
-- Garden Bud — Phase D #05: 社会保険計算（健保 / 厚年 / 介護 / 雇用）
-- ============================================================
-- 対応 spec: docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md
-- 作成: 2026-05-07（a-bud、main- No.86 全前倒し dispatch、Day 2 前倒し着手）
--
-- 目的:
--   月次給与・賞与で控除する社会保険料（健保 / 厚年 / 介護 / 雇用）を法令準拠で計算するための
--   基盤テーブル（等級表 / 料率 / 従業員別履歴 / 免除）を定義。計算ロジックは
--   src/app/bud/payroll/_lib/insurance-calculator.ts （純関数）で実装。
--
-- スコープ（本 migration で対応）:
--   1. bud_standard_remuneration_grades（等級表、健保 50 / 厚年 32 等級）
--   2. bud_insurance_rates（料率、都道府県別 + 業種別）
--   3. bud_employee_remuneration_history（従業員別 標準報酬履歴、月変・算定基礎・産休復帰の根拠）
--   4. bud_employee_insurance_exemptions（産休・育休の免除）
--   5. RLS（自分閲覧 + payroll_* + admin、UPDATE は admin のみ、DELETE 完全禁止）
--
-- 含めない:
--   - 月変判定 Cron → 後続 migration（必要 salary records 整備後）
--   - 算定基礎届 Cron → 同上
--   - 産休・育休 自動検知 → Phase E（当面手動登録）
--   - 計算本体ロジック → src/app/bud/payroll/_lib/insurance-calculator.ts
--
-- 適用方法:
--   Supabase Dashboard > garden-dev > SQL Editor で本ファイルを貼付 → Run。
--   等級表・料率の初期データは UI / 別 SQL で投入（東海林さん作業）。
-- ============================================================

-- ------------------------------------------------------------
-- 1. bud_standard_remuneration_grades（等級表）
-- ------------------------------------------------------------
-- 健保: 50 等級（協会けんぽ）/ 厚年: 32 等級
-- effective_year で年度切替（例: 2026 年度のレコードは effective_year=2026）
create table if not exists public.bud_standard_remuneration_grades (
  id uuid primary key default gen_random_uuid(),
  insurance_type text not null
    check (insurance_type in ('health', 'pension')),
  effective_year int not null
    check (effective_year between 2020 and 2099),
  grade int not null
    check (grade between 1 and 50),
  remuneration_min numeric(10, 0) not null
    check (remuneration_min >= 0),
  remuneration_max numeric(10, 0)
    check (remuneration_max is null or remuneration_max >= remuneration_min),
  standard_amount numeric(10, 0) not null
    check (standard_amount > 0),

  constraint uq_grade unique (insurance_type, effective_year, grade)
);

comment on table public.bud_standard_remuneration_grades is
  '社保 標準報酬月額 等級表。年度別、健保 50 / 厚年 32 等級。算定基礎・月変での grade lookup 元データ。';

create index if not exists idx_grades_lookup
  on public.bud_standard_remuneration_grades (insurance_type, effective_year, remuneration_min);

-- ------------------------------------------------------------
-- 2. bud_insurance_rates（料率）
-- ------------------------------------------------------------
-- 健保・介護: 都道府県別（協会けんぽ）/ 厚年: 一律 / 雇用: 業種別 + 労使比例
create table if not exists public.bud_insurance_rates (
  id uuid primary key default gen_random_uuid(),
  effective_from date not null,
  effective_to date,
  prefecture text,                                -- 健保・介護のみ、null = 全国（厚年・雇用用）
  industry_class text not null
    check (industry_class in ('general', 'agriculture_forestry_fishery', 'construction')),

  -- 健康保険（労使合計、折半は計算時）
  health_rate numeric(7, 6) not null
    check (health_rate >= 0 and health_rate < 1),
  long_term_care_rate numeric(7, 6) not null
    check (long_term_care_rate >= 0 and long_term_care_rate < 1),

  -- 厚生年金（一律）
  pension_rate numeric(7, 6) not null
    check (pension_rate >= 0 and pension_rate < 1),

  -- 雇用保険（業種別、労使比例）
  employment_total_rate numeric(7, 6) not null
    check (employment_total_rate >= 0 and employment_total_rate < 1),
  employment_employee_rate numeric(7, 6) not null
    check (employment_employee_rate >= 0 and employment_employee_rate < 1),

  notes text,
  created_at timestamptz not null default now(),

  constraint uq_rate
    unique (effective_from, prefecture, industry_class),
  constraint chk_rate_dates
    check (effective_to is null or effective_to >= effective_from),
  constraint chk_employment_employee_le_total
    check (employment_employee_rate <= employment_total_rate)
);

comment on table public.bud_insurance_rates is
  '社保料率の年度別マスタ。健保 + 介護は都道府県別、厚年は一律 (prefecture=NULL OK)、雇用は業種別。';

create index if not exists idx_rates_active
  on public.bud_insurance_rates (effective_from desc, prefecture, industry_class)
  where effective_to is null;

-- ------------------------------------------------------------
-- 3. bud_employee_remuneration_history（標準報酬 履歴）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_remuneration_history (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  insurance_type text not null
    check (insurance_type in ('health', 'pension')),
  effective_from date not null,
  effective_to date,
  grade int not null
    check (grade between 1 and 50),
  standard_amount numeric(10, 0) not null
    check (standard_amount > 0),
  reason text not null
    check (reason in ('initial', 'kettei', 'getsu_hen', 'sanzen_hen', 'manual')),
    -- initial=入社時, kettei=算定基礎届, getsu_hen=月変, sanzen_hen=産休・育休復帰時, manual=手動
  source_period_id uuid references public.bud_payroll_periods(id),
  notes text,
  created_at timestamptz not null default now(),
  created_by text references public.root_employees(employee_id),

  constraint uq_remuneration_history
    unique (employee_id, insurance_type, effective_from),
  constraint chk_remuneration_dates
    check (effective_to is null or effective_to >= effective_from)
);

comment on table public.bud_employee_remuneration_history is
  '従業員別 標準報酬月額の履歴。月変 / 算定基礎 / 産休復帰時改定の根拠。1 従業員 × 1 保険種別で時系列追跡。';

create index if not exists idx_remuneration_history_active
  on public.bud_employee_remuneration_history (employee_id, insurance_type, effective_from desc)
  where effective_to is null;
create index if not exists idx_remuneration_history_employee_type
  on public.bud_employee_remuneration_history (employee_id, insurance_type, effective_from desc);

-- ------------------------------------------------------------
-- 4. bud_employee_insurance_exemptions（免除）
-- ------------------------------------------------------------
create table if not exists public.bud_employee_insurance_exemptions (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id),
  exemption_type text not null
    check (exemption_type in ('maternity', 'childcare')),
    -- maternity=産前産後 (産前 6 週 + 産後 8 週), childcare=育休 (最長 子 2 歳まで)
  start_date date not null,
  end_date date,
  approved_by text references public.root_employees(employee_id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),

  constraint chk_exemption_dates
    check (end_date is null or end_date >= start_date)
);

comment on table public.bud_employee_insurance_exemptions is
  '産休・育休による社保免除。健保・厚年・介護は本人負担 + 会社負担とも 100% 免除、雇用は除外しない。';

create index if not exists idx_exemptions_employee_period
  on public.bud_employee_insurance_exemptions (employee_id, start_date desc);

-- ------------------------------------------------------------
-- 5. RLS（spec §6 反映 + D-09 で定義済み bud_has_payroll_role 利用）
-- ------------------------------------------------------------

alter table public.bud_standard_remuneration_grades enable row level security;
alter table public.bud_insurance_rates enable row level security;
alter table public.bud_employee_remuneration_history enable row level security;
alter table public.bud_employee_insurance_exemptions enable row level security;

-- ----- 等級表・料率（マスタデータ、payroll_* 全員 SELECT、admin のみ書込） -----
drop policy if exists grades_select on public.bud_standard_remuneration_grades;
create policy grades_select on public.bud_standard_remuneration_grades
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists grades_insert on public.bud_standard_remuneration_grades;
create policy grades_insert on public.bud_standard_remuneration_grades
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists grades_update on public.bud_standard_remuneration_grades;
create policy grades_update on public.bud_standard_remuneration_grades
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists grades_no_delete on public.bud_standard_remuneration_grades;
create policy grades_no_delete on public.bud_standard_remuneration_grades
  for delete
  using (false);

drop policy if exists rates_select on public.bud_insurance_rates;
create policy rates_select on public.bud_insurance_rates
  for select
  using (
    public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rates_insert on public.bud_insurance_rates;
create policy rates_insert on public.bud_insurance_rates
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rates_update on public.bud_insurance_rates;
create policy rates_update on public.bud_insurance_rates
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists rates_no_delete on public.bud_insurance_rates;
create policy rates_no_delete on public.bud_insurance_rates
  for delete
  using (false);

-- ----- 標準報酬履歴（自分閲覧 + payroll_* + admin、INSERT/UPDATE は payroll_calculator + admin） -----
drop policy if exists rh_select on public.bud_employee_remuneration_history;
create policy rh_select on public.bud_employee_remuneration_history
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_insert on public.bud_employee_remuneration_history;
create policy rh_insert on public.bud_employee_remuneration_history
  for insert
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_update on public.bud_employee_remuneration_history;
create policy rh_update on public.bud_employee_remuneration_history
  for update
  using (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  )
  with check (
    public.bud_has_payroll_role(array['payroll_calculator'])
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists rh_no_delete on public.bud_employee_remuneration_history;
create policy rh_no_delete on public.bud_employee_remuneration_history
  for delete
  using (false);

-- ----- 免除（自分閲覧 + payroll_* + admin、INSERT/UPDATE は admin のみ） -----
drop policy if exists ex_select on public.bud_employee_insurance_exemptions;
create policy ex_select on public.bud_employee_insurance_exemptions
  for select
  using (
    employee_id = (select id from public.root_employees where user_id = auth.uid() and deleted_at is null)
    or public.bud_has_payroll_role()
    or public.bud_is_admin_or_super_admin()
  );

drop policy if exists ex_insert on public.bud_employee_insurance_exemptions;
create policy ex_insert on public.bud_employee_insurance_exemptions
  for insert
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists ex_update on public.bud_employee_insurance_exemptions;
create policy ex_update on public.bud_employee_insurance_exemptions
  for update
  using (public.bud_is_admin_or_super_admin())
  with check (public.bud_is_admin_or_super_admin());

drop policy if exists ex_no_delete on public.bud_employee_insurance_exemptions;
create policy ex_no_delete on public.bud_employee_insurance_exemptions
  for delete
  using (false);

-- ============================================================
-- 確認クエリ（手動実行用）
-- ============================================================
-- -- テーブル確認
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN (
--       'bud_standard_remuneration_grades',
--       'bud_insurance_rates',
--       'bud_employee_remuneration_history',
--       'bud_employee_insurance_exemptions'
--     );
--
-- -- ポリシー確認
-- SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename LIKE 'bud_%insurance%' OR tablename LIKE 'bud_standard%' OR tablename LIKE 'bud_employee_remuneration%'
--   ORDER BY tablename, policyname;
