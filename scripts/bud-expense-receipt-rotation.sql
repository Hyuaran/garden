-- Bud expense receipt rotation persistence.
-- Apply in the Supabase SQL editor before deploying the application change.
-- Idempotent: the column and constraint are added only when missing.

alter table public.bud_expense_requests
  add column if not exists receipt_rotation smallint not null default 0;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.bud_expense_requests'::regclass
       and conname = 'bud_expense_requests_receipt_rotation_check'
  ) then
    alter table public.bud_expense_requests
      add constraint bud_expense_requests_receipt_rotation_check
      check (receipt_rotation in (0, 90, 180, 270));
  end if;
end
$$;

notify pgrst, 'reload schema';

-- Verification:
-- select column_name, data_type, is_nullable, column_default
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'bud_expense_requests'
--    and column_name = 'receipt_rotation';
