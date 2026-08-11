-- Garden Soil: FileMaker コール履歴バッチ同期ログ

create table if not exists public.soil_call_sync_log (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  batch_index integer not null check (batch_index >= 0),
  source text not null default 'callcenter-fm-agent',
  range_from date,
  range_to date,
  status text not null check (status in ('running', 'success', 'partial', 'failure')),
  triggered_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  records_fetched integer not null default 0 check (records_fetched >= 0),
  records_inserted integer not null default 0 check (records_inserted >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.soil_call_sync_log is
  'callcenter-fm-agentからのAPIバッチ単位同期ログ。run_idで同一エージェント実行を束ねる。';

create index if not exists idx_soil_call_sync_log_triggered_at
  on public.soil_call_sync_log (triggered_at desc);
create index if not exists idx_soil_call_sync_log_run_batch
  on public.soil_call_sync_log (run_id, batch_index);
create index if not exists idx_soil_call_sync_log_failures
  on public.soil_call_sync_log (triggered_at desc)
  where status in ('partial', 'failure');

create or replace function public.soil_call_sync_log_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_soil_call_sync_log_updated_at on public.soil_call_sync_log;
create trigger trg_soil_call_sync_log_updated_at
  before update on public.soil_call_sync_log
  for each row execute function public.soil_call_sync_log_set_updated_at();

alter table public.soil_call_sync_log enable row level security;
-- anon/authenticated向けpolicyは作成しない。取込APIのservice_roleのみが書き込む。

-- 適用後確認:
-- select tablename, rowsecurity from pg_tables where tablename in ('soil_call_history', 'soil_call_sync_log');
-- select status, count(*) from public.soil_call_sync_log group by status order by status;
