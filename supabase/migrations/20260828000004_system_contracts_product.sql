alter table public.system_contracts
  add column if not exists product text,
  add column if not exists template_docx_file_id text,
  add column if not exists template_docx_url text;
