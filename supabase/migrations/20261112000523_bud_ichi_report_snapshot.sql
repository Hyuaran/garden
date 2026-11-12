-- Apply manually; server-only snapshot.
create table public.bud_ichi_report_snapshot (
  id smallint primary key default 1 check (id = 1),
  deployment_id text not null,
  checked_at timestamptz not null,
  fetched_at timestamptz not null,
  updated text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  failed boolean not null default false
);
alter table public.bud_ichi_report_snapshot enable row level security;
revoke all on public.bud_ichi_report_snapshot from public, anon, authenticated;
grant all on public.bud_ichi_report_snapshot to service_role;
