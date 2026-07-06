-- Codex-098: bud_transfer_inbox にメール取込メタ情報を追加する。
-- 適用は Supabase SQL editor で手動実行する。冪等。

ALTER TABLE public.bud_transfer_inbox
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'drive',
  ADD COLUMN IF NOT EXISTS mail_meta jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bud_transfer_inbox_source_check'
       AND conrelid = 'public.bud_transfer_inbox'::regclass
  ) THEN
    ALTER TABLE public.bud_transfer_inbox
      ADD CONSTRAINT bud_transfer_inbox_source_check
      CHECK (source IN ('drive', 'mail'));
  END IF;
END $$;

COMMENT ON COLUMN public.bud_transfer_inbox.source IS
  '未処理トレイへの取込元。drive=複合機/Drive, mail=Microsoft Graph mailbox attachment.';

COMMENT ON COLUMN public.bud_transfer_inbox.mail_meta IS
  'メール取込メタ情報。{message_id, attachment_id, from, subject, received_at}.';
