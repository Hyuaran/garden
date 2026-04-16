-- ============================================================
-- Garden Forest — Supabase Schema
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. companies (法人マスタ)
CREATE TABLE IF NOT EXISTS companies (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  kessan text NOT NULL,
  color text NOT NULL,
  light text NOT NULL,
  sort_order int NOT NULL
);

-- 2. fiscal_periods (確定決算期)
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id serial PRIMARY KEY,
  company_id text NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ki int NOT NULL,
  yr int NOT NULL,
  period_from text NOT NULL,
  period_to text NOT NULL,
  uriage bigint,
  gaichuhi bigint,
  rieki bigint,
  junshisan bigint,
  genkin bigint,
  yokin bigint,
  doc_url text,
  UNIQUE (company_id, ki)
);

-- 3. shinkouki (進行期)
CREATE TABLE IF NOT EXISTS shinkouki (
  company_id text PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  ki int NOT NULL,
  yr int NOT NULL,
  label text NOT NULL,
  range text NOT NULL,
  reflected text NOT NULL,
  zantei boolean NOT NULL DEFAULT false,
  uriage bigint,
  gaichuhi bigint,
  rieki bigint
);

-- 4. forest_users (Forest アクセス権)
CREATE TABLE IF NOT EXISTS forest_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. forest_audit_log (監査ログ)
CREATE TABLE IF NOT EXISTS forest_audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE shinkouki ENABLE ROW LEVEL SECURITY;
ALTER TABLE forest_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE forest_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forest_select_companies" ON companies
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users)
  );

CREATE POLICY "forest_select_fiscal_periods" ON fiscal_periods
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users)
  );

CREATE POLICY "forest_select_shinkouki" ON shinkouki
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users)
  );

CREATE POLICY "forest_users_select_own" ON forest_users
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "forest_users_admin_select_all" ON forest_users
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

CREATE POLICY "forest_audit_insert" ON forest_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "forest_audit_admin_select" ON forest_audit_log
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM forest_users WHERE role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_company ON fiscal_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_yr ON fiscal_periods(yr);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON forest_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON forest_audit_log(created_at);
