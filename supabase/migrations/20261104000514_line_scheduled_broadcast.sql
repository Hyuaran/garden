alter table public.system_line_broadcast
  add column scheduled_at timestamptz,
  add column schedule_status text check (schedule_status in ('scheduled', 'sending', 'canceled', 'failed')),
  add column schedule_error text,
  add column updated_by text,
  add column updated_at timestamptz;

create index system_line_broadcast_schedule_idx
  on public.system_line_broadcast (schedule_status, scheduled_at);
