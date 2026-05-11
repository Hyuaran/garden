-- ============================================================
-- Bud Phase D + 5/11 拡張 全 13 migration 検証 SQL
-- ============================================================
-- 対応 dispatch: main- No. 295（a-bud-002 起草、a-main-023 が main DB で Run）
-- 用途: 13 件全 apply 完了後、テーブル/列数/RLS/拡張の存在を一括検証
-- 実行先: main 接続 (本番 DB)
-- 実行モード: SELECT only（安全、副作用なし）
--
-- 期待結果: 全 row が「OK」「true」「>0」「期待数値」になること
-- NG row があれば該当 migration の精密検証 (verify-bud-phase-d-XX.sql) を実施
-- ============================================================

-- ============================================================
-- §0. 前提拡張 + Root テーブル存在
-- ============================================================

select 'btree_gist 拡張' as item,
  case when count(*) > 0 then 'OK' else 'NG (D-09 で必要)' end as status
from pg_extension where extname = 'btree_gist';

select 'pgcrypto 拡張' as item,
  case when count(*) > 0 then 'OK' else 'NG (D-06 で必要)' end as status
from pg_extension where extname = 'pgcrypto';

select 'root_employees (Root 前提)' as item,
  case when count(*) > 0 then 'OK' else 'NG (Bud 全 FK の前提)' end as status
from information_schema.tables
where table_schema = 'public' and table_name = 'root_employees';

select 'root_companies (Root 前提)' as item,
  case when count(*) > 0 then 'OK' else 'NG (D-01/D-07/D-10/D-12 の FK 前提)' end as status
from information_schema.tables
where table_schema = 'public' and table_name = 'root_companies';

-- ============================================================
-- §1. Bud Phase D テーブル存在確認（全 41 テーブル）
-- ============================================================

with expected_tables(tname, mig) as (values
  -- # 1 D-01 attendance (3 tables)
  ('bud_payroll_periods', 'D-01'),
  ('bud_payroll_attendance_snapshots', 'D-01'),
  ('bud_payroll_attendance_overrides', 'D-01'),

  -- # 2 D-09 bank_accounts (3 tables)
  ('root_employee_payroll_roles', 'D-09'),
  ('bud_employee_bank_accounts', 'D-09'),
  ('bud_payment_recipients', 'D-09'),

  -- # 3 D-05 social_insurance (4 tables)
  ('bud_standard_remuneration_grades', 'D-05'),
  ('bud_insurance_rates', 'D-05'),
  ('bud_employee_remuneration_history', 'D-05'),
  ('bud_employee_insurance_exemptions', 'D-05'),

  -- # 4 D-02 salary_calculation (6 tables)
  ('bud_salary_records', 'D-02'),
  ('bud_employee_allowances', 'D-02'),
  ('bud_employee_deductions', 'D-02'),
  ('bud_withholding_tax_table_kou', 'D-02'),
  ('bud_withholding_tax_table_otsu', 'D-02'),
  ('bud_resident_tax_assignments', 'D-02'),

  -- # 5 D-03 bonus_calculation (2 tables)
  ('bud_bonus_records', 'D-03'),
  ('bud_bonus_withholding_rate_table', 'D-03'),

  -- # 6 D-07 bank_transfer (3 tables)
  ('bud_payroll_transfer_batches', 'D-07'),
  ('bud_payroll_transfer_items', 'D-07'),
  ('bud_payroll_accounting_reports', 'D-07'),

  -- # 7 D-11 mfc_csv (2 tables)
  ('bud_mfc_csv_exports', 'D-11'),
  ('bud_mfc_csv_export_items', 'D-11'),

  -- # 8 D-04 statement_distribution (2 tables)
  ('bud_payroll_notifications', 'D-04'),
  ('bud_salary_statements', 'D-04'),

  -- # 9 D-10 payroll_integration (3 tables)
  ('bud_payroll_records', 'D-10'),
  ('bud_payroll_calculation_history', 'D-10'),
  ('bud_incentive_rate_tables', 'D-10'),

  -- # 10 D-12 schedule (3 tables)
  ('bud_payroll_schedule', 'D-12'),
  ('bud_payroll_schedule_settings', 'D-12'),
  ('bud_payroll_reminder_log', 'D-12'),

  -- # 11 D-06 nenmatsu (3 tables)
  ('bud_year_end_settlements', 'D-06'),
  ('root_employees_pii', 'D-06'),
  ('bud_pii_access_log', 'D-06'),

  -- # 12 Bank 5/11 (3 tables)
  ('bud_bank_accounts', 'Bank'),
  ('bud_bank_balances', 'Bank'),
  ('bud_bank_transactions', 'Bank'),

  -- # 13 Shiwakechou 5/11 (3 tables)
  ('bud_journal_accounts', 'Shiwakechou'),
  ('bud_journal_entries', 'Shiwakechou'),
  ('bud_journal_export_logs', 'Shiwakechou')
)
select
  e.mig,
  e.tname,
  case when t.table_name is not null then 'OK' else 'NG' end as status
from expected_tables e
left join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.tname
order by e.mig, e.tname;

-- ============================================================
-- §2. helpers 関数存在確認（D-09 で定義、他 11 件で利用）
-- ============================================================

select
  routine_name,
  case when count(*) > 0 then 'OK' else 'NG' end as status
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('bud_has_payroll_role', 'bud_is_admin_or_super_admin', 'bud_is_super_admin')
group by routine_name;

-- D-06 PII helpers
select
  routine_name,
  case when count(*) > 0 then 'OK' else 'NG' end as status
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('bud_encrypt_my_number', 'bud_decrypt_my_number')
group by routine_name;

-- ============================================================
-- §3. RLS 有効化確認（全 Bud テーブル）
-- ============================================================

select
  c.relname as tname,
  case when c.relrowsecurity then 'OK' else 'NG (RLS 無効)' end as rls_status
from pg_class c
where c.relkind = 'r'
  and c.relname like 'bud\_%'
  and c.relnamespace = 'public'::regnamespace
order by c.relname;

-- ============================================================
-- §4. テーブル数集計（migration 別期待値と比較）
-- ============================================================

select
  case
    when table_name like 'bud_payroll_period%' or table_name like 'bud_payroll_attendance%' then 'D-01'
    when table_name = 'root_employee_payroll_roles' or table_name like 'bud_employee_bank%' or table_name = 'bud_payment_recipients' then 'D-09'
    when table_name like 'bud_standard_remun%' or table_name = 'bud_insurance_rates' or table_name like 'bud_employee_remun%' or table_name like 'bud_employee_insur%' then 'D-05'
    when table_name = 'bud_salary_records' or table_name like 'bud_employee_allow%' or table_name like 'bud_employee_deduct%' or table_name like 'bud_withholding%' or table_name like 'bud_resident%' then 'D-02'
    when table_name = 'bud_bonus_records' or table_name = 'bud_bonus_withholding_rate_table' then 'D-03'
    when table_name like 'bud_payroll_transfer%' or table_name = 'bud_payroll_accounting_reports' then 'D-07'
    when table_name like 'bud_mfc_csv%' then 'D-11'
    when table_name = 'bud_payroll_notifications' or table_name = 'bud_salary_statements' then 'D-04'
    when table_name = 'bud_payroll_records' or table_name = 'bud_payroll_calculation_history' or table_name = 'bud_incentive_rate_tables' then 'D-10'
    when table_name like 'bud_payroll_schedule%' or table_name = 'bud_payroll_reminder_log' then 'D-12'
    when table_name = 'bud_year_end_settlements' or table_name = 'root_employees_pii' or table_name = 'bud_pii_access_log' then 'D-06'
    when table_name like 'bud_bank_%' then 'Bank'
    when table_name like 'bud_journal_%' then 'Shiwakechou'
  end as mig_group,
  count(*) as actual_count
from information_schema.tables
where table_schema = 'public'
  and (table_name like 'bud\_%' or table_name = 'root_employee_payroll_roles' or table_name = 'root_employees_pii')
group by mig_group
order by mig_group;

-- 期待: D-01=3, D-09=3, D-05=4, D-02=6, D-03=2, D-07=3, D-11=2, D-04=2, D-10=3, D-12=3, D-06=3, Bank=3, Shiwakechou=3
-- 総計 = 40 (root_employees_pii 含む、root_employee_payroll_roles は D-09 group に含む)

-- ============================================================
-- §5. 重要制約存在確認（一例）
-- ============================================================

-- D-09 EXCLUDE 制約 (1 employee 1 active account)
select
  conname,
  case when count(*) > 0 then 'OK' else 'NG' end as status
from pg_constraint
where conname = 'uq_eba_active_account_per_employee'
group by conname;

-- D-06 自起票承認禁止 CHECK
select
  conname,
  case when count(*) > 0 then 'OK' else 'NG' end as status
from pg_constraint
where conname = 'chk_yes_no_self_approval'
group by conname;

-- ============================================================
-- end of verify-bud-phase-d-all.sql
-- ============================================================
