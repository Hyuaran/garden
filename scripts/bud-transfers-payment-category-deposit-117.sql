-- Codex-117: add deposit (預金) to bud_transfers.payment_category.
-- Run in the Supabase SQL Editor for the target environment.

alter table public.bud_transfers
  drop constraint if exists bud_transfers_payment_category_check;

alter table public.bud_transfers
  add constraint bud_transfers_payment_category_check
  check (payment_category in ('transfer', 'payeasy', 'cash', 'registered', 'deposit'));

comment on column public.bud_transfers.payment_category is
  '支払区分: transfer=振込, payeasy=ペイジー, cash=現金, registered=決済登録済, deposit=預金';

notify pgrst, 'reload schema';
