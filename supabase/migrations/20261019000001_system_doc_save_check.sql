-- 適用は別途実施。自動保存履歴は手動で削除されたファイルの再投入も防ぐ。
begin;
create table if not exists public.system_doc_save_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  trigger text not null,
  applied boolean not null default false,
  ok boolean not null default true,
  error text,
  counts jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb
);
create index if not exists system_doc_save_runs_ran_at_idx on public.system_doc_save_runs (ran_at desc);
create table if not exists public.system_doc_saved_files (
  md5 text primary key,
  kind text not null check (kind in ('contract', 'terms-in', 'terms-out')),
  root_folder_id text not null,
  drive_file_id text not null,
  drive_url text not null,
  message_id text not null,
  mailbox text not null,
  file_name text not null,
  saved_at timestamptz not null default now()
);
alter table public.system_doc_save_runs enable row level security;
alter table public.system_doc_saved_files enable row level security;
revoke all on public.system_doc_save_runs, public.system_doc_saved_files from anon, authenticated;
grant all on public.system_doc_save_runs, public.system_doc_saved_files to service_role;
grant usage, select on sequence public.system_doc_save_runs_id_seq to service_role;
commit;
