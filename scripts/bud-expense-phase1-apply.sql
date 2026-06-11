-- ============================================================
-- Garden Bud — 経費精算 Phase 1 production apply SQL
-- Target: production accounting DB (Supabase SQL Editor で実行)
-- Purpose: 経費精算リニューアルの土台となる 3 テーブルを安全に新設する。
--
-- 作るもの（いずれも IF NOT EXISTS / ポリシーは未存在時のみ作成）:
--   public.bud_expense_categories   経費区分マスタ
--   public.bud_expense_requests     経費申請データ（スマホ申請〜仕訳化まで）
--   public.garden_work_log          作業ログ（工数）= Garden 全業務横断の裏側基盤
--
-- 安全性:
--   - CREATE TABLE/INDEX IF NOT EXISTS、ポリシーは pg_policies で未存在時のみ作成。
--   - DROP / DELETE / TRUNCATE / 既存データ書換えは一切しない。
--   - 既存テーブル(bud_corporations / root_employees / bud_journal_entries /
--     bud_files / auth.users)を参照するのみ。
--   - RLS ヘルパー関数(bud_has_access 等)は未存在時のみ作成（既存定義は触らない）。
-- ============================================================

-- ------------------------------------------------------------
-- 0. RLS ヘルパー関数（未存在時のみ作成。既存の本番定義は温存）
--    出典: scripts/bud-transfers-statements-prod-apply.sql
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
END $$;

-- 申請者本人の employee_id を返すヘルパー（スマホ申請者の自己アクセス判定用）
DO $$
BEGIN
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
-- 1. bud_expense_categories（経費区分マスタ）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_expense_categories (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL UNIQUE,            -- 区分名（駐車場 / 会議費 …）
  debit_account_code text,                            -- 借方勘定科目コード（bud_journal_accounts.account_code を想定・FKは張らない）
  debit_account_name text,                            -- 借方勘定科目名（表示用）
  tax_class          text,                            -- 税区分（不課税 / 課税10 / 軽減8 …）
  default_qualified  text CHECK (default_qualified IN ('有','無','自動')) DEFAULT '自動', -- 適格区分の既定
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
-- 2. bud_expense_requests（経費申請データ）
--   状態フロー: submitted(承認待ち) → final_pending(完了待ち) → journalize_pending(仕訳化) → journalized
--   差戻し: keiri_returned(経理が差戻し) / final_returned(東海林が差戻し)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_expense_requests (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_id         text UNIQUE,                          -- 経理ID（KR........ 採番は後続フェーズ）
  receipt_no            integer,                              -- 領収書No（法人×期で連番・後続）
  corp_id               text REFERENCES public.bud_corporations(id),       -- 法人
  applicant_employee_id text REFERENCES public.root_employees(employee_id),-- 使用者（申請者）

  -- 申請者撮影 / OCR 由来
  receipt_date          date,                                 -- レシート日付
  store_name            text,                                 -- 店名
  amount                bigint NOT NULL DEFAULT 0,            -- 金額
  qualified_class       text CHECK (qualified_class IN ('有','無')),       -- 適格区分（T番号有無で自動判定）
  qualified_number      text,                                 -- 適格番号（T番号）
  category_id           uuid REFERENCES public.bud_expense_categories(id),-- 区分
  description           text,                                 -- 摘要

  -- 領収書画像
  receipt_file_id       uuid REFERENCES public.bud_files(id),  -- 既存添付参照（任意）
  drive_file_id         text,                                  -- Google Drive ファイルID
  drive_view_url        text,                                  -- Drive 閲覧URL

  -- ワークフロー
  status                text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted','keiri_returned','final_pending','final_returned','journalize_pending','journalized')),
  return_reason         text,                                  -- 差戻し理由

  -- ステージ担当者・日時（工数・履歴用。詳細集計は garden_work_log と併用）
  submitted_at          timestamptz NOT NULL DEFAULT now(),    -- 申請日時
  submitted_by          uuid REFERENCES auth.users(id),
  keiri_checked_by      uuid REFERENCES auth.users(id),        -- 承認待ち(経理)処理者
  keiri_checked_at      timestamptz,
  final_checked_by      uuid REFERENCES auth.users(id),        -- 完了待ち(東海林)処理者
  final_checked_at      timestamptz,
  journalized_by        uuid REFERENCES auth.users(id),
  journalized_at        timestamptz,
  journal_entry_id      uuid REFERENCES public.bud_journal_entries(id),    -- 仕訳化先
  fiscal_period         text,                                  -- 決算区分（第10期 等）

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_status     ON public.bud_expense_requests(status);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_corp       ON public.bud_expense_requests(corp_id);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_applicant  ON public.bud_expense_requests(applicant_employee_id);
CREATE INDEX IF NOT EXISTS idx_bud_expense_requests_rcpt_date  ON public.bud_expense_requests(receipt_date);

-- ------------------------------------------------------------
-- 3. garden_work_log（作業ログ＝工数。Garden 全業務横断の裏側基盤）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.garden_work_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),                 -- 誰が（認証ユーザー）
  employee_id text REFERENCES public.root_employees(employee_id),
  module      text NOT NULL DEFAULT 'bud',                    -- bud / leaf / root …
  operation   text NOT NULL,                                  -- 操作種別（expense_keiri_approve / expense_keiri_return / expense_final_approve / expense_final_return / expense_journalize …）
  target_kind text,                                            -- 対象種別（expense_request 等）
  target_id   text,                                            -- 対象ID
  corp_id     text,                                            -- 法人（任意）
  started_at  timestamptz,                                     -- 作業開始（任意）
  ended_at    timestamptz NOT NULL DEFAULT now(),              -- 作業完了（打刻）
  duration_ms integer,                                         -- 所要ミリ秒（アプリ計測・任意）
  detail      jsonb,                                           -- 付随情報
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
  -- bud_expense_categories : Bud アクセス者は閲覧、承認者以上が編集
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

  -- bud_expense_requests : 経理は全件、申請者は自分の申請のみ
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_select') THEN
    CREATE POLICY ber_select ON public.bud_expense_requests FOR SELECT
      USING (public.bud_has_access() OR applicant_employee_id = public.bud_my_employee_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_insert') THEN
    CREATE POLICY ber_insert ON public.bud_expense_requests FOR INSERT
      WITH CHECK (public.bud_has_access() OR applicant_employee_id = public.bud_my_employee_id());
  END IF;
  -- 更新は経理レビュー（承認待ち/完了待ち/仕訳化）。Bud アクセス者のみ。
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_update') THEN
    CREATE POLICY ber_update ON public.bud_expense_requests FOR UPDATE
      USING (public.bud_has_access()) WITH CHECK (public.bud_has_access());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bud_expense_requests' AND policyname='ber_delete') THEN
    CREATE POLICY ber_delete ON public.bud_expense_requests FOR DELETE USING (public.bud_is_admin());
  END IF;

  -- garden_work_log : 本人は自分の分を記録/閲覧、管理者は全件閲覧。改ざん防止のため更新は不可。
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
-- Grants（PostgREST 露出。行はRLSが制御）
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_expense_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_expense_requests   TO authenticated;
GRANT SELECT, INSERT, DELETE        ON TABLE public.garden_work_log         TO authenticated;

GRANT EXECUTE ON FUNCTION public.bud_has_access()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_approver_or_above()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_admin()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_my_employee_id()        TO authenticated;

-- ============================================================
-- 経費区分マスタ 初期シード（idempotent: name 重複はスキップ）
-- 勘定科目コード/税区分は暫定。区分マスタ画面で後から調整可。
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
