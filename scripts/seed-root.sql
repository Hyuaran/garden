-- ============================================================
-- Garden Root — Seed Data
-- Run this AFTER root-schema.sql in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. 法人マスタ（6社）
-- ============================================================
INSERT INTO root_companies (company_id, company_name, company_name_kana, representative, default_bank)
VALUES
  ('COMP-001', '株式会社ヒュアラン',     'カブシキガイシャヒュアラン',     '後道 翔太', '楽天銀行'),
  ('COMP-002', '株式会社センターライズ',   'カブシキガイシャセンターライズ',   '後道 翔太', 'みずほ銀行'),
  ('COMP-003', '株式会社リンクサポート',   'カブシキガイシャリンクサポート',   '後道 翔太', '楽天銀行'),
  ('COMP-004', '株式会社ARATA',          'カブシキガイシャアラタ',         '後道 翔太', '楽天銀行'),
  ('COMP-005', '株式会社たいよう',        'カブシキガイシャタイヨウ',       '後道 翔太', '楽天銀行'),
  ('COMP-006', '株式会社壱',             'カブシキガイシャイチ',          '後道 翔太', '楽天銀行')
ON CONFLICT (company_id) DO NOTHING;

-- ============================================================
-- 2. 給与体系マスタ（3パターン）
-- ============================================================
INSERT INTO root_salary_systems (salary_system_id, system_name, employment_type, base_salary_type, working_hours_day, working_days_month, overtime_rate, night_overtime_rate, holiday_overtime_rate)
VALUES
  ('SAL-SYS-001', '正社員標準',         '正社員',     '月給', 7.0, 20.0, 1.25, 1.35, 1.35),
  ('SAL-SYS-002', '正社員役員',         '正社員',     '月給', 7.0, 20.0, 1.25, 1.35, 1.35),
  ('SAL-SYS-003', 'アルバイト標準',     'アルバイト', '時給', 7.0, 20.0, 1.25, 1.35, 1.35)
ON CONFLICT (salary_system_id) DO NOTHING;

-- ============================================================
-- 3. 社会保険マスタ（2026年度）
-- ============================================================
INSERT INTO root_insurance (insurance_id, fiscal_year, effective_from, effective_to, health_insurance_rate, nursing_insurance_rate, pension_rate, employment_insurance_rate, child_support_rate)
VALUES
  ('INS-2026', '2026', '2026-04-01', '2027-03-31', 4.905, 0.800, 9.150, 0.600, 0.050)
ON CONFLICT (insurance_id) DO NOTHING;
