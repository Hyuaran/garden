alter table public.root_employees
  add column if not exists attendance_rule text not null default 'sales'
    check (attendance_rule in ('sales', 'office'));

comment on column public.root_employees.attendance_rule is
  'KOT打刻CSV生成時の数え方。sales=30分丸めと枠、office=Garden打刻を1分単位で送る。';

update public.root_employees
  set attendance_rule = 'office'
  where replace(name, '　', ' ') in ('川中 美来', '東海林 美琴', '簡 棣榮', '小谷 庵');

alter table public.system_attendance_punches
  add column if not exists kot_punched_at timestamptz,
  add column if not exists kot_batch_id uuid;

comment on column public.system_attendance_punches.kot_punched_at is
  'KOT取込CSVへ出した加工後の打刻日時。Gardenの生打刻 punched_at は変更しない。';

comment on column public.system_attendance_punches.kot_batch_id is
  'この打刻が送信中または同期済みになった KOT CSV 生成束。';

create table if not exists public.system_attendance_kot_batch (
  batch_id uuid primary key,
  generated_at timestamptz not null default now(),
  csv_rows jsonb not null default '[]'::jsonb,
  status text not null default 'sending'
    check (status in ('sending', 'synced', 'reverted')),
  confirmed_at timestamptz,
  reverted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_system_attendance_kot_batch_status_generated
  on public.system_attendance_kot_batch(status, generated_at desc);

create index if not exists idx_system_attendance_punches_kot_batch
  on public.system_attendance_punches(kot_batch_id)
  where kot_batch_id is not null;

alter table public.system_attendance_kot_batch enable row level security;

comment on table public.system_attendance_kot_batch is
  'KOT打刻CSVの生成束。合成休憩行を含むCSV全行を保持する。';

-- Post-apply verification:
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('root_employees', 'system_attendance_punches', 'system_attendance_kot_batch')
--   and column_name in ('attendance_rule', 'kot_punched_at', 'kot_batch_id', 'csv_rows', 'status')
-- order by table_name, ordinal_position;
