create table if not exists public.system_innovera_sync_log (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null,
  applied boolean not null,
  ok boolean not null,
  innovera_count integer,
  kintone_count integer,
  added integer not null default 0,
  renamed integer not null default 0,
  retired integer not null default 0,
  needs_review integer not null default 0,
  failed integer not null default 0,
  details jsonb not null default '[]'::jsonb,
  error text,
  actor_employee_id text
);

alter table public.system_innovera_sync_log enable row level security;
