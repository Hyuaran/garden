alter table public.system_line_target
  add column if not exists summary_keywords text[] not null default array['NHK']::text[],
  add column if not exists label text null;
