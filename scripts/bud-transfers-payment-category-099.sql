-- Codex-099: bud_transfers に支払区分とペイジー番号を追加する。
-- 適用は Supabase SQL editor で手動実行する。冪等。

ALTER TABLE public.bud_transfers
  ADD COLUMN IF NOT EXISTS payment_category text NOT NULL DEFAULT 'transfer',
  ADD COLUMN IF NOT EXISTS registered_method text,
  ADD COLUMN IF NOT EXISTS manual_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payeasy_biller_no text,
  ADD COLUMN IF NOT EXISTS payeasy_customer_no text,
  ADD COLUMN IF NOT EXISTS payeasy_confirm_no text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bud_transfers_payment_category_check'
       AND conrelid = 'public.bud_transfers'::regclass
  ) THEN
    ALTER TABLE public.bud_transfers
      ADD CONSTRAINT bud_transfers_payment_category_check
      CHECK (payment_category IN ('transfer', 'payeasy', 'cash', 'registered'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bud_transfers_registered_method_check'
       AND conrelid = 'public.bud_transfers'::regclass
  ) THEN
    ALTER TABLE public.bud_transfers
      ADD CONSTRAINT bud_transfers_registered_method_check
      CHECK (registered_method IS NULL OR registered_method IN ('credit_card', 'direct_debit', 'auto_transfer'));
  END IF;
END $$;

COMMENT ON COLUMN public.bud_transfers.payment_category IS
  '支払区分。transfer=振込, payeasy=ペイジー, cash=現金, registered=決済登録済。';

COMMENT ON COLUMN public.bud_transfers.registered_method IS
  '決済登録済の方法。credit_card=クレカ, direct_debit=口座振替, auto_transfer=自動振込。';

COMMENT ON COLUMN public.bud_transfers.manual_paid_at IS
  '現金の精算済み、またはペイジーの支払済みを手動打刻した日時。';

COMMENT ON COLUMN public.bud_transfers.payeasy_biller_no IS
  'ペイジー収納機関番号。払込票の5桁番号。';

COMMENT ON COLUMN public.bud_transfers.payeasy_customer_no IS
  'ペイジーお客様番号。払込票からOCRまたは手入力で保持。';

COMMENT ON COLUMN public.bud_transfers.payeasy_confirm_no IS
  'ペイジー確認番号。払込票からOCRまたは手入力で保持。';
