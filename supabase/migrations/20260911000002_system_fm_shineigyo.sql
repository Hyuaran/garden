begin;

create table if not exists public.system_fm_shineigyo (
  "主キー" text primary key,
  "電話番号" text,
  "携帯番号" text,
  "リスト名" text,
  "営業ID" text,
  "受注日" date,
  "既契約情報" text,
  "既契約回線タイプ" text,
  "既契約継続有無" text,
  "修正日" text,
  run_id uuid,
  "取込日時" timestamptz not null default now()
);

create index if not exists idx_system_fm_shineigyo_phone
  on public.system_fm_shineigyo ("電話番号");

create index if not exists idx_system_fm_shineigyo_mobile
  on public.system_fm_shineigyo ("携帯番号");

create table if not exists public.system_fm_shineigyo_sync_log (
  id bigserial primary key,
  run_id uuid not null unique,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_rows integer not null default 0,
  status text not null check (status in ('running', 'success', 'failure', 'count_mismatch')),
  error_message text
);

create index if not exists idx_system_fm_shineigyo_sync_log_run_id
  on public.system_fm_shineigyo_sync_log (run_id);

alter table public.system_fm_shineigyo enable row level security;
alter table public.system_fm_shineigyo_sync_log enable row level security;

drop policy if exists system_fm_shineigyo_service_role_all on public.system_fm_shineigyo;
create policy system_fm_shineigyo_service_role_all on public.system_fm_shineigyo
  for all to service_role
  using (true)
  with check (true);

drop policy if exists system_fm_shineigyo_sync_log_service_role_all on public.system_fm_shineigyo_sync_log;
create policy system_fm_shineigyo_sync_log_service_role_all on public.system_fm_shineigyo_sync_log
  for all to service_role
  using (true)
  with check (true);

revoke all on table public.system_fm_shineigyo from anon, authenticated;
revoke all on table public.system_fm_shineigyo_sync_log from anon, authenticated;
grant select, insert, update, delete on table public.system_fm_shineigyo to service_role;
grant select, insert, update, delete on table public.system_fm_shineigyo_sync_log to service_role;
grant usage, select on sequence public.system_fm_shineigyo_sync_log_id_seq to service_role;

comment on table public.system_fm_shineigyo is 'FileMaker「コール履歴」ファイル内の「新営業」表を毎朝丸ごと写した分析用スナップショット';
comment on table public.system_fm_shineigyo_sync_log is 'FileMaker「新営業」スナップショット取込の実行記録';

commit;
