create table if not exists public.system_innovera_recording_play_log (
  id bigint generated always as identity primary key,
  played_at timestamptz not null default now(),
  employee_id text not null,
  access text not null,
  cdr_id text not null,
  uniqid text,
  call_started_at text,
  own_extension text,
  call_extension text,
  counterpart_number text
);

create index if not exists system_innovera_recording_play_log_played_idx
  on public.system_innovera_recording_play_log (played_at desc);

alter table public.system_innovera_recording_play_log enable row level security;

create table if not exists public.system_innovera_line_change_log (
  id bigint generated always as identity primary key,
  changed_at timestamptz not null default now(),
  changed_by_employee_id text not null,
  target_employee_id text not null,
  innovera_user_id text not null,
  from_circuit_id text,
  from_circuit_name text,
  to_circuit_id text not null,
  to_circuit_name text,
  ok boolean not null,
  error text
);

alter table public.system_innovera_line_change_log enable row level security;
