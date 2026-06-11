-- ============================================================
-- Garden Bud — 経費精算 Phase 1 production apply SQL  (v2: bud_users 先行作成を追加)
-- Target: production accounting DB (Supabase SQL Editor で実行)
-- Purpose: 経費精算リニューアルの土台となるテーブルを安全に新設する。
--
-- 作るもの（いずれも IF NOT EXISTS / ポリシーは未存在時のみ作成）:
--   public.bud_users                Bud 権限テーブル（RLSヘルパー関数が必要とするため先行作成。空でOK）
--   public.bud_expense_categories   経費区分マスタ
--   public.bud_expense_requests     経費申請データ（スマホ申請〜仕訳化まで）
--   public.garden_work_log          作業ログ（工数）= Garden 全業務横断の裏側基盤
--
-- 安全性:
--   - CREATE TABLE/INDEX IF NOT EXISTS、ポリシーは pg_policies で未存在時のみ作成。
--   - DROP / DELETE / TRUNCATE / 既存データ書換えは一切しない。
--   - 既存テーブル(bud_corporations / root_employees / bud_journal_entries /
--     bud_files / auth.users)を参照するのみ。
-- ============================================================

-- ------------------------------------------------------------
-- 0. bud_users（権限テーブル。RLSヘルパー関数が参照するので先に作る。空のままで可）
--    出典: scripts/bud-schema.sql / bud-transfers-statements-prod-apply.sql
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL UNIQUE REFERENCES public.root_employees(employee_id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bud_role    text NOT NULL CHECK (bud_role IN ('admin','approver','staff')),
  is_active   boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bud_users_employee ON public.bud_users(employee_id);
CREATE INDEX IF NOT EXISTS idx_bud_users_user_id  ON public.bud_users(user_id);

-- ------------------------------------------------------------
-- 1. RLS ヘルパー関数（未存在時のみ作成。既存定義は温存）
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='bud_has_access'
      AND pg_get_function_identity_arguments(p.oid)=''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_has_access() RETURNS boolean
        LANGUAGE sql SECURITY DEFINER STABLE AS $fn$
        SELECT EXISTS (
          SELECT 1 FROM public.root_employees e
          LEFT JOIN public.bud_users b ON b.employee_id=e.employee_id AND b.is_active=true
          WHERE e.user_id=auth.uid() AND e.is_active=true
            AND (e.garden_role IN ('admin','super_admin') OR b.bud_role IS NOT NULL)
        );
      $fn$;
    $create$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='bud_is_approver_or_above'
      AND pg_get_function_identity_arguments(p.oid)=''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_is_approver_or_above() RETURNS boolean
        LANGUAGE sql SECURITY DEFINER STABLE AS $fn$
        SELECT EXISTS (
          SELECT 1 FROM public.root_employees e
          LEFT JOIN public.bud_users b ON b.employee_id=e.employee_id AND b.is_active=true
          WHERE e.user_id=auth.uid() AND e.is_active=true
            AND (e.garden_role IN ('admin','super_admin') OR b.bud_role IN ('admin','approver'))
        );
      $fn$;
    $create$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='bud_is_admin'
      AND pg_get_function_identity_arguments(p.oid)=''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_is_admin() RETURNS boolean
        LANGUAGE sql SECURITY DEFINER STABLE AS $fn$
        SELECT EXISTS (
          SELECT 1 FROM public.root_employees e
          LEFT JOIN public.bud_users b ON b.employee_id=e.employee_id AND b.is_active=true
          WHERE e.user_id=auth.uid() AND e.is_active=true
            AND (e.garden_role IN ('admin','super_admin') OR b.bud_role='admin')
        );
      $fn$;
    $create$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='bud_my_employee_id'
      AND pg_get_function_identity_arguments(p.oid)=''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_my_employee_id() RETURNS text
        LANGUAGE sql SECURITY DEFINER STABLE AS $fn$
        SELECT e.employee_id FROM public.root_employees e
        WHERE e.user_id=auth.uid() AND e.is_active=true
        LIMIT 1;
      $fn$;
    $create$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1b. bud_users RLS + GRANT
-- ------------------------------------------------------------
ALTER TABLE public.bud_users ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_users' AND policyname='bud_users_select_all') THEN
    CREATE POLICY bud_users_select_all ON public.bud_users FOR SELECT USING (public.bud_has_access());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_users' AND policyname='bud_users_write_admin') THEN
    CREATE POLICY bud_users_write_admin ON public.bud_users FOR ALL
      USING (public.bud_is_admin()) WITH CHECK (public.bud_is_admin());
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. bud_expense_categories（経費区分マスタ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_expense_categories (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,
  debit_account_code text,
  debit_account_name text,
  tax_class          text,
  default_qualified  text CHECK (default_qualified IN ('有','無','自動')) DEFAULT '自動',
  display_order      integer NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid REFERENCES auth.users(id),
  updated_by         uuid REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_bud_expense_categories_active
  ON public.bud_expense_categories(is_active, display_order);

-- ------------------------------------------------------------
-- 3. bud_expense_requests（経費申請データ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_expense_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_id         text UNIQUE,
  receipt_no            integer,
  corp_id               text REFERENCES public.bud_corporations(id),
  applicant_employee_id text REFERENCES public.root_employees(employee_id),
  receipt_date          date,
  store_name            text,
  amount                bigint NOT NULL DEFAULT 0,
  qualified_class       text CHECK (qualified_class IN ('有','無')),
  qualified_number      text,
  category_id           uuid REFERENCES public.bud_expense_categories(id),
  description           text,
  receipt_file_id       uuid REFERENCES public.bud_files(id),
  drive_file_id         text,
  drive_view_url        text,
  status                text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','keiri_returned','final_pending','final_returned','journalize_pending','journalized')),
  return_reason         text,
  submitted_at          timestamptz NOT NULL DEFAULT now(),
  submitted_by          uuid REFERENCES auth.users(id),
  keiri_checked_by      uuid REFERENCES auth.users(id),
  keiri_checked_at      timestamptz,
  final_checked_by      uuid REFERENCES auth.users(id),
  final_checked_at      timestamptz,
  journalized_by        uuid REFERENCES auth.users(id),
  journalized_at        timestamptz,
  journal_entry_id      uuid REFERENCES public.bud_journal_entries(id),
  fiscal_period         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_status     ON public.bud_expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_corp       ON public.bud_expense_requests(corp_id);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_applicant  ON public.bud_expense_requests(applicant_employee_id);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_rcpt_date  ON public.bud_expense_requests(receipt_date);

-- ------------------------------------------------------------
-- 4. garden_work_log（作業ログ＝工数。Garden 全業務横断の裏側基盤）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garden_work_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  employee_id text REFERENCES public.root_employees(employee_id),
  module      text NOT NULL DEFAULT 'bud',
  operation   text NOT NULL,
  target_kind text,
  target_id   text,
  corp_id     text,
  started_at  timestamptz,
  ended_at    timestamptz NOT NULL DEFAULT now(),
  duration_ms integer,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_garden_work_log_user_day ON public.garden_work_log(user_id, ended_at);
CREATE INDEX IF NOT EXISTS idx_garden_work_log_op_day   ON public.garden_work_log(operation, ended_at);
CREATE INDEX IF NOT EXISTS idx_garden_work_log_target   ON public.garden_work_log(target_kind, target_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.bud_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bud_expense_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_work_log        ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_categories' AND policyname='bec_select') THEN
    CREATE POLICY bec_select ON public.bud_expense_categories FOR SELECT USING (public.bud_has_access());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_categories' AND policyname='bec_insert') THEN
    CREATE POLICY bec_insert ON public.bud_expense_categories FOR INSERT WITH CHECK (public.bud_is_approver_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_categories' AND policyname='bec_update') THEN
    CREATE POLICY bec_update ON public.bud_expense_categories FOR UPDATE USING (public.bud_is_approver_or_above()) WITH CHECK (public.bud_is_approver_or_above());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_categories' AND policyname='bec_delete') THEN
    CREATE POLICY bec_delete ON public.bud_expense_categories FOR DELETE USING (public.bud_is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_select') THEN
    CREATE POLICY ber_select ON public.bud_expense_requests FOR SELECT
      USING (public.bud_has_access() OR applicant_employee_id = public.bud_my_employee_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_insert') THEN
    CREATE POLICY ber_insert ON public.bud_expense_requests FOR INSERT
      WITH CHECK (public.bud_has_access() OR applicant_employee_id = public.bud_my_employee_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_update') THEN
    CREATE POLICY ber_update ON public.bud_expense_requests FOR UPDATE
      USING (public.bud_has_access()) WITH CHECK (public.bud_has_access());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_delete') THEN
    CREATE POLICY ber_delete ON public.bud_expense_requests FOR DELETE USING (public.bud_is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_work_log' AND policyname='gwl_select') THEN
    CREATE POLICY gwl_select ON public.garden_work_log FOR SELECT
      USING (user_id = auth.uid() OR public.bud_is_admin());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_work_log' AND policyname='gwl_insert') THEN
    CREATE POLICY gwl_insert ON public.garden_work_log FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='garden_work_log' AND policyname='gwl_no_delete') THEN
    CREATE POLICY gwl_no_delete ON public.garden_work_log FOR DELETE USING (public.bud_is_admin());
  END IF;
END $$;

-- ============================================================
-- Grants
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_users               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_expense_categories  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_expense_requests    TO authenticated;
GRANT SELECT, INSERT, DELETE         ON TABLE public.garden_work_log         TO authenticated;

GRANT EXECUTE ON FUNCTION public.bud_has_access()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_approver_or_above()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_admin()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_my_employee_id()        TO authenticated;

-- ============================================================
-- 経費区分マスタ 初期シード（idempotent: name 重複はスキップ）
-- ============================================================
INSERT INTO public.bud_expense_categories (name, debit_account_name, tax_class, display_order)
VALUES
  ('旅費交通費', '旅費交通費', '課税10', 10),
  ('駐車場',     '旅費交通費', '課税10', 20),
  ('会議費',     '会議費',     '課税10', 30),
  ('消耗品費',   '消耗品費',   '課税10', 40),
  ('接待交際費', '接待交際費', '課税10', 50),
  ('通信費',     '通信費',     '課税10', 60),
  ('新聞図書費', '新聞図書費', '課税10', 70),
  ('水道光熱費', '水道光熱費', '課税10', 80),
  ('租税公課',   '租税公課',   '不課税', 90),
  ('雑費',       '雑費',       '課税10', 100)
ON CONFLICT (name) DO NOTHING;

NOTIFY pgrst, 'reload schema';
