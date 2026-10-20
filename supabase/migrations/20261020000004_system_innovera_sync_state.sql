create table if not exists public.system_innovera_sync_state (
  id integer primary key default 1 check (id = 1),
  last_checked_at timestamptz not null,
  last_ok boolean not null
);

-- sync_log と同様、ブラウザーへの直接公開はせず認可済みサーバーから読む。
alter table public.system_innovera_sync_state enable row level security;
