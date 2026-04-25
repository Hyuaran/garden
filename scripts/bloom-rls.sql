-- ============================================================
-- Garden Bloom — Row Level Security
-- 7 テーブル全ての RLS 有効化 + ポリシー定義
--
-- 前提:
--   1. scripts/bloom-helper-functions.sql を適用済み
--   2. scripts/bloom-schema.sql を適用済み
--
-- 権限設計（CLAUDE.md Bloom §権限設計 準拠）:
--   super_admin / admin : 全員分 read / 自分 write（admin は代理 write も可）
--   manager             : 全員の "忙しさ指標のみ" read（列絞り込みはクライアント側、§10.3 判4）
--   staff/cs/closer/toss: 自分分のみ read/write
--
-- Run in: Supabase Dashboard > SQL Editor (garden-dev のみ)
-- ============================================================

-- ============================================================
-- 1. bloom_worker_status
--    staff: 自分のみ / manager+: 全員 read / admin+: 代理 write 可
-- ============================================================
ALTER TABLE bloom_worker_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bws_read_self         ON bloom_worker_status;
DROP POLICY IF EXISTS bws_read_manager_plus ON bloom_worker_status;
DROP POLICY IF EXISTS bws_write_self        ON bloom_worker_status;
DROP POLICY IF EXISTS bws_write_admin       ON bloom_worker_status;

CREATE POLICY bws_read_self ON bloom_worker_status
  FOR SELECT USING (user_id = auth.uid());

-- manager 以上は全員の行を read 可（"忙しさ指標のみ" の絞り込みはクライアントで列制限）
CREATE POLICY bws_read_manager_plus ON bloom_worker_status
  FOR SELECT USING (bloom_has_access('manager'));

CREATE POLICY bws_write_self ON bloom_worker_status
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- admin 以上は代理更新可（updated_by で追跡）
CREATE POLICY bws_write_admin ON bloom_worker_status
  FOR ALL USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ============================================================
-- 2. bloom_daily_logs
--    self: 自分の read/write / admin+: 全員 read
-- ============================================================
ALTER TABLE bloom_daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bdl_read_self  ON bloom_daily_logs;
DROP POLICY IF EXISTS bdl_read_admin ON bloom_daily_logs;
DROP POLICY IF EXISTS bdl_write_self ON bloom_daily_logs;

CREATE POLICY bdl_read_self  ON bloom_daily_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY bdl_read_admin ON bloom_daily_logs FOR SELECT USING (bloom_has_access('admin'));
CREATE POLICY bdl_write_self ON bloom_daily_logs FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 3. bloom_roadmap_entries
--    staff+ read / admin+ write
-- ============================================================
ALTER TABLE bloom_roadmap_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bre_read  ON bloom_roadmap_entries;
DROP POLICY IF EXISTS bre_write ON bloom_roadmap_entries;

CREATE POLICY bre_read  ON bloom_roadmap_entries FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bre_write ON bloom_roadmap_entries FOR ALL
  USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ============================================================
-- 4. bloom_project_progress
--    staff+ read / admin+ write
-- ============================================================
ALTER TABLE bloom_project_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bpp_read  ON bloom_project_progress;
DROP POLICY IF EXISTS bpp_write ON bloom_project_progress;

CREATE POLICY bpp_read  ON bloom_project_progress FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bpp_write ON bloom_project_progress FOR ALL
  USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ============================================================
-- 5. bloom_module_progress
--    staff+ read / admin+ write
-- ============================================================
ALTER TABLE bloom_module_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bmp_read  ON bloom_module_progress;
DROP POLICY IF EXISTS bmp_write ON bloom_module_progress;

CREATE POLICY bmp_read  ON bloom_module_progress FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bmp_write ON bloom_module_progress FOR ALL
  USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ============================================================
-- 6. bloom_monthly_digests
--    staff+ read / admin+ write
-- ============================================================
ALTER TABLE bloom_monthly_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bmd_read  ON bloom_monthly_digests;
DROP POLICY IF EXISTS bmd_write ON bloom_monthly_digests;

CREATE POLICY bmd_read  ON bloom_monthly_digests FOR SELECT USING (bloom_has_access('staff'));
CREATE POLICY bmd_write ON bloom_monthly_digests FOR ALL
  USING (bloom_has_access('admin')) WITH CHECK (bloom_has_access('admin'));

-- ============================================================
-- 7. bloom_chatwork_config
--    super_admin のみ read/write（API トークン機密のため）
-- ============================================================
ALTER TABLE bloom_chatwork_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bcc_rw ON bloom_chatwork_config;

CREATE POLICY bcc_rw ON bloom_chatwork_config FOR ALL
  USING (bloom_has_access('super_admin'))
  WITH CHECK (bloom_has_access('super_admin'));
