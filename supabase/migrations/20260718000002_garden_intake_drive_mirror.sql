alter table public.garden_intake_items
  add column if not exists drive_file_id text;

comment on column public.garden_intake_items.drive_file_id is
  'Best-effort Google Drive mirror file ID. null when mirroring was skipped or failed.';
