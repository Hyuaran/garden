begin;
-- KOT の所属・雇用区分の控え（KOT の API が止まる 8:30〜10:00・17:30〜18:30 でも入社予定者を登録できるように）2026-10-26
create table public.system_kot_options_cache (
 id text primary key check (id = 'hire'),
 divisions jsonb not null default '[]'::jsonb,
 working_types jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
alter table public.system_kot_options_cache enable row level security;
revoke all on public.system_kot_options_cache from anon, authenticated;
grant all on public.system_kot_options_cache to service_role;
commit;
