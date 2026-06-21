-- Codex-088: Garden Bud transfer invoice inbox
-- Apply manually in Supabase. Codex does not touch production DB.

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

CREATE OR REPLACE FUNCTION public.bud_update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bud_transfer_inbox_updated_at ON public.bud_transfer_inbox;
CREATE TRIGGER trg_bud_transfer_inbox_updated_at
  BEFORE UPDATE ON public.bud_transfer_inbox
  FOR EACH ROW EXECUTE FUNCTION public.bud_update_updated_at();

ALTER TABLE public.bud_transfer_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bud_transfer_inbox_select ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_select ON public.bud_transfer_inbox
  FOR SELECT
  USING (public.bud_has_access());

DROP POLICY IF EXISTS bud_transfer_inbox_update ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_update ON public.bud_transfer_inbox
  FOR UPDATE
  USING (public.bud_has_access())
  WITH CHECK (public.bud_has_access());

DROP POLICY IF EXISTS bud_transfer_inbox_insert_none ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_insert_none ON public.bud_transfer_inbox
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS bud_transfer_inbox_delete_none ON public.bud_transfer_inbox;
CREATE POLICY bud_transfer_inbox_delete_none ON public.bud_transfer_inbox
  FOR DELETE
  USING (false);

GRANT SELECT, UPDATE ON TABLE public.bud_transfer_inbox TO authenticated;
