-- ============================================================
-- Garden Bud production apply SQL v2
-- Target: production accounting DB
-- Purpose: create Bud transfer foundation for the current Root schema.
--
-- Safe scope:
--   - Creates/extends only the minimum Bud transfer tables:
--       public.bud_users
--       public.bud_transfers
--       public.bud_transfer_inbox
--   - Uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.
--   - Does not DROP, DELETE, TRUNCATE, or rewrite existing data.
--   - Does not create bud_statements or bud_statement_import_batches.
--
-- Important production schema alignment:
--   - public.root_bank_accounts primary key is id uuid.
--   - public.root_bank_accounts has corp_code, not company_id/account_id.
--   - bud_transfers.source_account_id references public.root_bank_accounts(id).
--
-- Run location:
--   Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 0. bud_users and helper functions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE OR REPLACE FUNCTION public.bud_update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bud_users_updated_at'
      AND tgrelid = 'public.bud_users'::regclass
  ) THEN
    CREATE TRIGGER trg_bud_users_updated_at
      BEFORE UPDATE ON public.bud_users
      FOR EACH ROW EXECUTE FUNCTION public.bud_update_updated_at();
  END IF;
END $$;

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

ALTER TABLE public.bud_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bud_users_select_all" ON public.bud_users;
CREATE POLICY "bud_users_select_all" ON public.bud_users
  FOR SELECT USING (public.bud_has_access());

DROP POLICY IF EXISTS "bud_users_insert_admin" ON public.bud_users;
CREATE POLICY "bud_users_insert_admin" ON public.bud_users
  FOR INSERT WITH CHECK (public.root_can_write());

DROP POLICY IF EXISTS "bud_users_update_admin" ON public.bud_users;
CREATE POLICY "bud_users_update_admin" ON public.bud_users
  FOR UPDATE USING (public.root_can_write()) WITH CHECK (public.root_can_write());

DROP POLICY IF EXISTS "bud_users_delete_admin" ON public.bud_users;
CREATE POLICY "bud_users_delete_admin" ON public.bud_users
  FOR DELETE USING (public.root_can_write());

-- ------------------------------------------------------------
-- 1. bud_transfers
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
  source_account_id            uuid REFERENCES public.root_bank_accounts(id),
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
    coalesce((scheduled_date - DATE '1970-01-01')::text, '') || ',' ||
    coalesce(payee_bank_code, '') || ',' ||
    coalesce(payee_branch_code, '') || ',' ||
    coalesce(payee_account_number, '') || ',' ||
    amount::text
  ) STORED,
  status_changed_at            timestamptz,
  status_changed_by            uuid REFERENCES auth.users(id)
);

ALTER TABLE public.bud_transfers
  ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES public.root_bank_accounts(id),
  ADD COLUMN IF NOT EXISTS request_company_id text REFERENCES public.root_companies(company_id),
  ADD COLUMN IF NOT EXISTS execute_company_id text REFERENCES public.root_companies(company_id),
  ADD COLUMN IF NOT EXISTS payee_bank_name text,
  ADD COLUMN IF NOT EXISTS payee_branch_name text,
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bud_transfers_updated_at'
      AND tgrelid = 'public.bud_transfers'::regclass
  ) THEN
    CREATE TRIGGER trg_bud_transfers_updated_at
      BEFORE UPDATE ON public.bud_transfers
      FOR EACH ROW EXECUTE FUNCTION public.bud_update_updated_at();
  END IF;
END $$;

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

ALTER TABLE public.bud_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bud_transfers_select_all" ON public.bud_transfers;
CREATE POLICY "bud_transfers_select_all" ON public.bud_transfers
  FOR SELECT USING (public.bud_has_access());

DROP POLICY IF EXISTS "bud_transfers_insert_staff" ON public.bud_transfers;
CREATE POLICY "bud_transfers_insert_staff" ON public.bud_transfers
  FOR INSERT WITH CHECK (public.bud_has_access());

DROP POLICY IF EXISTS "bud_transfers_update_draft_edit" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_draft_to_confirmed" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_review_admin" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_approval_admin" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_self_approve_super_admin" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_csv_export_super_admin" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_update_complete_admin" ON public.bud_transfers;
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

DROP POLICY IF EXISTS "bud_transfers_delete_draft_super_admin" ON public.bud_transfers;
CREATE POLICY "bud_transfers_delete_draft_super_admin" ON public.bud_transfers
  FOR DELETE
  USING (
    status = '下書き'
    AND public.root_is_super_admin()
  );

-- ------------------------------------------------------------
-- 2. bud_transfer_inbox
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bud_transfer_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  public_url text,
  status text NOT NULL DEFAULT 'pending',
  transfer_id text REFERENCES public.bud_transfers(transfer_id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  discarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bud_transfer_inbox_status_check
    CHECK (status IN ('pending', 'consumed', 'discarded')),
  CONSTRAINT bud_transfer_inbox_mime_check
    CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png'))
);

COMMENT ON TABLE public.bud_transfer_inbox IS
  'Bud transfer invoice intake tray. Files are imported from Drive without OCR; OCR runs only when a user creates a transfer.';
COMMENT ON COLUMN public.bud_transfer_inbox.drive_file_id IS
  'Google Drive file id. Unique to prevent duplicate imports.';
COMMENT ON COLUMN public.bud_transfer_inbox.storage_path IS
  'Path copied into Supabase Storage bucket bud-attachments.';
COMMENT ON COLUMN public.bud_transfer_inbox.public_url IS
  'Public URL for the copied file in bud-attachments, used as invoice_pdf_url or scan_image_url.';

CREATE INDEX IF NOT EXISTS idx_bud_transfer_inbox_status_imported
  ON public.bud_transfer_inbox(status, imported_at DESC);
CREATE INDEX IF NOT EXISTS idx_bud_transfer_inbox_transfer
  ON public.bud_transfer_inbox(transfer_id)
  WHERE transfer_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_bud_transfer_inbox_updated_at'
      AND tgrelid = 'public.bud_transfer_inbox'::regclass
  ) THEN
    CREATE TRIGGER trg_bud_transfer_inbox_updated_at
      BEFORE UPDATE ON public.bud_transfer_inbox
      FOR EACH ROW EXECUTE FUNCTION public.bud_update_updated_at();
  END IF;
END $$;

ALTER TABLE public.bud_transfer_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bud_transfer_inbox_select ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_select ON public.bud_transfer_inbox
  FOR SELECT USING (public.bud_has_access());

DROP POLICY IF EXISTS bud_transfer_inbox_update ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_update ON public.bud_transfer_inbox
  FOR UPDATE USING (public.bud_has_access()) WITH CHECK (public.bud_has_access());

DROP POLICY IF EXISTS bud_transfer_inbox_insert_none ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_insert_none ON public.bud_transfer_inbox
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS bud_transfer_inbox_delete_none ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_delete_none ON public.bud_transfer_inbox
  FOR DELETE USING (false);

-- ------------------------------------------------------------
-- Grants and schema cache
-- ------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE public.bud_users TO anon;
GRANT SELECT ON TABLE public.bud_transfers TO anon;
GRANT SELECT ON TABLE public.bud_transfer_inbox TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bud_transfers TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.bud_transfer_inbox TO authenticated;

GRANT EXECUTE ON FUNCTION public.bud_has_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_approver_or_above() TO authenticated;
GRANT EXECUTE ON FUNCTION public.bud_is_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';
