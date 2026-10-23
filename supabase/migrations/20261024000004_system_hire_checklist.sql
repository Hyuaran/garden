alter table public.system_hire_candidates
  add column checklist jsonb not null default '{}'::jsonb;
