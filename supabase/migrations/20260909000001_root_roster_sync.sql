alter table public.root_employees
  add column if not exists roster_record_id text,
  add column if not exists garden_role_manual boolean not null default false;

comment on column public.root_employees.roster_record_id is
  'Kintone 従業員名簿のレコードID。退職日などの書き戻しに使う。';

comment on column public.root_employees.garden_role_manual is
  'true の場合、名簿同期で garden_role を上書きしない。既存の手入力ロール維持用。';

update public.root_employees
  set garden_role_manual = true
  where garden_role is not null
    and garden_role_manual = false;

create table if not exists public.root_roster_sync_log (
  id bigserial primary key,
  synced_at timestamptz not null default now(),
  dry_run boolean not null default false,
  roster_records integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  accounts_created_count integer not null default 0,
  auth_banned_count integer not null default 0,
  auth_unbanned_count integer not null default 0,
  errors text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_root_roster_sync_log_synced_at
  on public.root_roster_sync_log (synced_at desc);

comment on table public.root_roster_sync_log is
  'Kintone 従業員名簿から Root 従業員マスタへの同期実行ログ。';
