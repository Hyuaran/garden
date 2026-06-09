-- ============================================================
-- Garden Bud production apply SQL
-- Target: production accounting DB
-- Purpose: create missing Bud transfer/statement tables safely.
--
-- Safe scope:
--   - Creates only the three missing tables when absent:
--       public.bud_transfers
--       public.bud_statement_import_batches
--       public.bud_statements
--   - Uses CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
--   - Enables RLS and creates policies only when each policy is absent.
--   - Grants table visibility/operation privileges to anon/authenticated.
--   - Does not DROP, DELETE, TRUNCATE, or rewrite existing data.
--
-- Run location:
--   Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions used by the Bud RLS policies.
-- Existing functions are left untouched.
-- Source: scripts/bud-rls.sql
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bud_has_access'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_has_access()
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
      AS $fn$
        SELECT EXISTS (
          SELECT 1
          FROM public.root_employees e
          LEFT JOIN public.bud_users b
            ON b.employee_id = e.employee_id
           AND b.is_active = true
          WHERE e.user_id = auth.uid()
            AND e.is_active = true
            AND (
              e.garden_role IN ('admin', 'super_admin')
              OR b.bud_role IS NOT NULL
            )
        );
      $fn$;
    $create$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bud_is_approver_or_above'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_is_approver_or_above()
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
      AS $fn$
        SELECT EXISTS (
          SELECT 1
          FROM public.root_employees e
          LEFT JOIN public.bud_users b
            ON b.employee_id = e.employee_id
           AND b.is_active = true
          WHERE e.user_id = auth.uid()
            AND e.is_active = true
            AND (
              e.garden_role IN ('admin', 'super_admin')
              OR b.bud_role IN ('admin', 'approver')
            )
        );
      $fn$;
    $create$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'bud_is_admin'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $create$
      CREATE FUNCTION public.bud_is_admin()
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        STABLE
      AS $fn$
        SELECT EXISTS (
          SELECT 1
          FROM public.root_employees e
          LEFT JOIN public.bud_users b
            ON b.employee_id = e.employee_id
           AND b.is_active = true
          WHERE e.user_id = auth.uid()
            AND e.is_active = true
            AND (
              e.garden_role IN ('admin', 'super_admin')
              OR b.bud_role = 'admin'
            )
        );
      $fn$;
    $create$;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. bud_transfers
-- Sources:
--   - scripts/bud-schema.sql section 2
--   - scripts/bud-transfers-v2.sql
--   - scripts/bud-a03-status-history-migration.sql section 1 columns only
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_transfers (
  transfer_id                  text PRIMARY KEY,
  status                       text NOT NULL DEFAULT '下書き'
    CHECK (status IN ('下書き','確認済み','承認待ち','承認済み','CSV出力済み','振込完了','差戻し')),
  data_source                  text,
  transfer_type                text,
  request_date                 date NOT NULL DEFAULT CURRENT_DATE,
  due_date                     date,
  scheduled_date               date,
  executed_date                date,
  company_id                   text REFERENCES public.root_companies(company_id),
  source_account_id            text REFERENCES public.root_bank_accounts(account_id),
  vendor_id                    text REFERENCES public.root_vendors(vendor_id),
  payee_name                   text NOT NULL,
  payee_bank_name              text,
  payee_bank_code              text,
  payee_branch_name            text,
  payee_branch_code            text,
  payee_account_type           text,
  payee_account_number         text,
  payee_account_holder_kana    text,
  fee_bearer                   text DEFAULT '当方負担',
  amount                       integer NOT NULL,
  description                  text,
  created_by                   uuid REFERENCES auth.users(id),
  confirmed_by                 uuid REFERENCES auth.users(id),
  confirmed_at                 timestamptz,
  approved_by                  uuid REFERENCES auth.users(id),
  approved_at                  timestamptz,
  csv_exported_by              uuid REFERENCES auth.users(id),
  csv_exported_at              timestamptz,
  executed_by                  uuid REFERENCES auth.users(id),
  rejection_reason             text,
  batch_code                   text,
  duplicate_flag               boolean NOT NULL DEFAULT false,
  duplicate_confirmed          boolean NOT NULL DEFAULT false,
  scan_image_url               text,
  invoice_pdf_url              text,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),

  transfer_category            text CHECK (transfer_category IN ('regular', 'cashback')),
  request_company_id           text REFERENCES public.root_companies(company_id),
  execute_company_id           text REFERENCES public.root_companies(company_id),
  cashback_applicant_name_kana text,
  cashback_applicant_name      text,
  cashback_applicant_phone     text,
  cashback_customer_id         text,
  cashback_order_date          date,
  cashback_opened_date         date,
  cashback_product_name        text,
  cashback_channel_name        text,
  cashback_partner_code        text,
  cashback_application_status  text CHECK (cashback_application_status IN ('pending', 'under_review', 'approved', 'rejected', 'returned')),
  payee_mismatch_confirmed     boolean NOT NULL DEFAULT false,
  expense_category_id          text,
  forest_account_id            text,
  duplicate_key                text GENERATED ALWAYS AS (
    concat_ws(
      ',',
      to_char(scheduled_date, 'YYYYMMDD'),
      payee_bank_code,
      payee_branch_code,
      payee_account_number,
      amount::text
    )
  ) STORED,
  status_changed_at            timestamptz,
  status_changed_by            uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_bud_transfers_status
  ON public.bud_transfers(status);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_company
  ON public.bud_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_scheduled
  ON public.bud_transfers(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_request_company
  ON public.bud_transfers(request_company_id);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_execute_company
  ON public.bud_transfers(execute_company_id);
CREATE INDEX IF NOT EXISTS idx_bud_transfers_transfer_category
  ON public.bud_transfers(transfer_category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bud_transfers_duplicate_key
  ON public.bud_transfers(duplicate_key)
  WHERE duplicate_flag = false AND duplicate_key IS NOT NULL;

-- ------------------------------------------------------------
-- 2. bud_statement_import_batches
-- Source: scripts/bud-a06-statements-migration.sql section 1
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_statement_import_batches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id    text NOT NULL REFERENCES public.root_bank_accounts(account_id),
  source_type        text NOT NULL CHECK (source_type IN ('rakuten_csv', 'mizuho_csv', 'paypay_csv', 'manual')),
  file_name          text NOT NULL,
  file_storage_path  text,
  row_count          int NOT NULL DEFAULT 0,
  success_count      int NOT NULL DEFAULT 0,
  error_count        int NOT NULL DEFAULT 0,
  skipped_count      int NOT NULL DEFAULT 0,
  auto_matched_count int NOT NULL DEFAULT 0,
  imported_at        timestamptz NOT NULL DEFAULT now(),
  imported_by        uuid NOT NULL REFERENCES auth.users(id),
  status             text CHECK (status IN ('completed', 'partial', 'failed')) DEFAULT 'completed',
  error_summary      text
);

CREATE INDEX IF NOT EXISTS bud_statement_import_batches_account_idx
  ON public.bud_statement_import_batches(bank_account_id, imported_at DESC);

-- ------------------------------------------------------------
-- 3. bud_statements
-- Source: scripts/bud-a06-statements-migration.sql section 2
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_statements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id     text NOT NULL REFERENCES public.root_bank_accounts(account_id),
  transaction_date    date NOT NULL,
  transaction_time    time,
  amount              bigint NOT NULL,
  balance_after       bigint,
  description         text NOT NULL,
  transaction_type    text,
  memo                text,
  matched_transfer_id text REFERENCES public.bud_transfers(transfer_id),
  matched_at          timestamptz,
  matched_by          uuid REFERENCES auth.users(id),
  match_confidence    text CHECK (match_confidence IN ('exact', 'high', 'manual')),
  category            text,
  subcategory         text,
  cc_meisai_id        text,
  source_type         text NOT NULL CHECK (source_type IN ('rakuten_csv', 'mizuho_csv', 'paypay_csv', 'manual')),
  imported_batch_id   uuid REFERENCES public.bud_statement_import_batches(id),
  raw_row             jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_statement_dedupe
    UNIQUE NULLS NOT DISTINCT (bank_account_id, transaction_date, transaction_time, amount, description)
);

CREATE INDEX IF NOT EXISTS bud_statements_account_date_idx
  ON public.bud_statements(bank_account_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS bud_statements_matched_idx
  ON public.bud_statements(matched_transfer_id)
  WHERE matched_transfer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bud_statements_unmatched_outflow_idx
  ON public.bud_statements(transaction_date DESC)
  WHERE matched_transfer_id IS NULL AND amount < 0;

-- ------------------------------------------------------------
-- RLS
-- Sources:
--   - scripts/bud-rls.sql
--   - scripts/bud-rls-v2.sql
--   - scripts/bud-rls-v3-review-fixes.sql
--   - scripts/bud-a06-statements-migration.sql sections 3-4
-- Note:
--   Import batch UPDATE is allowed for bud_has_access() because the current
--   frontend updates success/error/skipped/auto-match counters after insert.
-- ------------------------------------------------------------
ALTER TABLE public.bud_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bud_statement_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bud_statements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_select_all'
  ) THEN
    CREATE POLICY "bud_transfers_select_all" ON public.bud_transfers
      FOR SELECT USING (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_insert_staff'
  ) THEN
    CREATE POLICY "bud_transfers_insert_staff" ON public.bud_transfers
      FOR INSERT WITH CHECK (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_draft_edit'
  ) THEN
    CREATE POLICY "bud_transfers_update_draft_edit" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '下書き'
        AND (created_by = auth.uid() OR public.bud_is_admin())
      )
      WITH CHECK (
        status = '下書き'
        AND (created_by = auth.uid() OR public.bud_is_admin())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_draft_to_confirmed'
  ) THEN
    CREATE POLICY "bud_transfers_update_draft_to_confirmed" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '下書き'
        AND public.bud_is_admin()
        AND created_by <> auth.uid()
      )
      WITH CHECK (
        status = '確認済み'
        AND public.bud_is_admin()
        AND created_by <> auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_review_admin'
  ) THEN
    CREATE POLICY "bud_transfers_update_review_admin" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '確認済み'
        AND public.bud_is_admin()
      )
      WITH CHECK (
        status IN ('確認済み', '承認待ち', '下書き')
        AND public.bud_is_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_approval_admin'
  ) THEN
    CREATE POLICY "bud_transfers_update_approval_admin" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '承認待ち'
        AND public.bud_is_admin()
        AND created_by <> auth.uid()
      )
      WITH CHECK (
        status IN ('承認済み', '差戻し')
        AND public.bud_is_admin()
        AND created_by <> auth.uid()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_self_approve_super_admin'
  ) THEN
    CREATE POLICY "bud_transfers_update_self_approve_super_admin" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '下書き'
        AND created_by = auth.uid()
        AND public.root_is_super_admin()
      )
      WITH CHECK (
        status = '承認済み'
        AND public.root_is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_csv_export_super_admin'
  ) THEN
    CREATE POLICY "bud_transfers_update_csv_export_super_admin" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = '承認済み'
        AND public.root_is_super_admin()
      )
      WITH CHECK (
        status = 'CSV出力済み'
        AND public.root_is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_update_complete_admin'
  ) THEN
    CREATE POLICY "bud_transfers_update_complete_admin" ON public.bud_transfers
      FOR UPDATE
      USING (
        status = 'CSV出力済み'
        AND public.bud_is_admin()
      )
      WITH CHECK (
        status = '振込完了'
        AND public.bud_is_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_transfers'
      AND policyname = 'bud_transfers_delete_draft_super_admin'
  ) THEN
    CREATE POLICY "bud_transfers_delete_draft_super_admin" ON public.bud_transfers
      FOR DELETE
      USING (
        status = '下書き'
        AND public.root_is_super_admin()
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statements'
      AND policyname = 'bs_select'
  ) THEN
    CREATE POLICY bs_select ON public.bud_statements
      FOR SELECT USING (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statements'
      AND policyname = 'bs_insert'
  ) THEN
    CREATE POLICY bs_insert ON public.bud_statements
      FOR INSERT WITH CHECK (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statements'
      AND policyname = 'bs_update'
  ) THEN
    CREATE POLICY bs_update ON public.bud_statements
      FOR UPDATE
      USING (public.bud_is_approver_or_above())
      WITH CHECK (public.bud_is_approver_or_above());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statements'
      AND policyname = 'bs_delete'
  ) THEN
    CREATE POLICY bs_delete ON public.bud_statements
      FOR DELETE USING (public.bud_is_admin());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statement_import_batches'
      AND policyname = 'bsib_select'
  ) THEN
    CREATE POLICY bsib_select ON public.bud_statement_import_batches
      FOR SELECT USING (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statement_import_batches'
      AND policyname = 'bsib_insert'
  ) THEN
    CREATE POLICY bsib_insert ON public.bud_statement_import_batches
      FOR INSERT WITH CHECK (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statement_import_batches'
      AND policyname = 'bsib_update'
  ) THEN
    CREATE POLICY bsib_update ON public.bud_statement_import_batches
      FOR UPDATE
      USING (public.bud_has_access())
      WITH CHECK (public.bud_has_access());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bud_statement_import_batches'
      AND policyname = 'bsib_no_delete'
  ) THEN
    CREATE POLICY bsib_no_delete ON public.bud_statement_import_batches
      FOR DELETE USING (false);
  END IF;
END $$;

-- ------------------------------------------------------------
-- Grants
-- Mirrors the table-exposure style used for existing Bud tables:
-- grant base table privileges to Supabase roles and let RLS decide rows.
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.bud_transfers TO anon;
GRANT SELECT ON TABLE public.bud_statement_import_batches TO anon;
GRANT SELECT ON TABLE public.bud_statements TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_transfers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_statement_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_statements TO authenticated;

GRANT EXECUTE ON FUNCTION public.bud_has_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_approver_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';

