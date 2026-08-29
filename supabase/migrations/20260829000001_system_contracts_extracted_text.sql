alter table public.system_contracts
  add column if not exists extracted_text text;
