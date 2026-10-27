create table public.system_vercel_usage_daily (
  day date not null,
  service text not null,
  usage numeric not null,
  unit text not null,
  cost_usd numeric not null,
  fetched_at timestamptz not null default now(),
  primary key (day, service)
);
create table public.system_vercel_usage_alerts (
  key text primary key,
  active boolean not null default false,
  since timestamptz,
  last_notified_at timestamptz,
  detail jsonb not null default '{}'::jsonb
);
alter table public.system_vercel_usage_daily enable row level security;
alter table public.system_vercel_usage_alerts enable row level security;
revoke all on public.system_vercel_usage_daily, public.system_vercel_usage_alerts from public, anon, authenticated;
grant all on public.system_vercel_usage_daily, public.system_vercel_usage_alerts to service_role;
