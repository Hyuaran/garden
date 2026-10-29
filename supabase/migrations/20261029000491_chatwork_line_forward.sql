-- One claim per Chatwork message; insert before sending to prevent redelivery races.
create table public.system_chatwork_line_forward (
  message_id text primary key,
  room_id text not null,
  line_target_id text,
  from_account_id text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now()
);
-- Per-destination results support multiple groups and monthly sent-row counts.
create table public.system_chatwork_line_forward_delivery (
  message_id text not null references public.system_chatwork_line_forward(message_id),
  line_target_id text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz not null default now(),
  primary key (message_id, line_target_id)
);
create index on public.system_chatwork_line_forward (created_at);
create index on public.system_chatwork_line_forward_delivery (created_at);
alter table public.system_chatwork_line_forward enable row level security;
alter table public.system_chatwork_line_forward_delivery enable row level security;
revoke all on public.system_chatwork_line_forward, public.system_chatwork_line_forward_delivery from public, anon, authenticated;
grant all on public.system_chatwork_line_forward, public.system_chatwork_line_forward_delivery to service_role;
