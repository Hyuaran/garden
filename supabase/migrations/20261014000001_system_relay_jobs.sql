create table if not exists public.system_relay_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('innovera', 'kot')),
  request jsonb not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'expired')),
  result jsonb,
  error text,
  requested_by text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists system_relay_jobs_status_created_at_idx
  on public.system_relay_jobs (status, created_at);

alter table public.system_relay_jobs enable row level security;

comment on table public.system_relay_jobs is 'ホストPC中継の仕事キュー。service_role だけが読む。';
comment on column public.system_relay_jobs.kind is '中継の種類。innovera または kot。';
comment on column public.system_relay_jobs.request is 'ホストPCへ渡す要求本文。録音本体は入れない。';
comment on column public.system_relay_jobs.requested_by is 'screen / cron / manual などの要求元。';
comment on column public.system_relay_jobs.expires_at is 'ホストPCが処理しなかった場合の期限。';

create table if not exists public.system_relay_heartbeat (
  id text primary key,
  last_seen_at timestamptz not null,
  agent_version text,
  notified_down_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.system_relay_heartbeat enable row level security;

comment on table public.system_relay_heartbeat is 'ホストPC中継エージェントの生存確認。service_role だけが読む。';
comment on column public.system_relay_heartbeat.id is 'host-pc の 1 行を使う。';
comment on column public.system_relay_heartbeat.notified_down_at is '停止通知を送った時刻。復旧時に null へ戻す。';
