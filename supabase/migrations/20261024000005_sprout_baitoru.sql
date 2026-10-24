begin;
alter table public.sprout_applicants
 add column inquiry_no text unique,
 add column source text not null default 'kintone' check(source in ('kintone','baitoru')),
 add column notified_at timestamptz,
 add column notify_error text,
 add column is_repeat boolean not null default false,
 add column mirror_record_id text unique;
create table public.sprout_baitoru_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 period_start date not null default '2026-09-22', chatwork_title text not null default '【バイトル新規応募】',
 exclude_inquiry_nos text[] not null default '{}', notify_room text not null default 'dev' check(notify_room in ('production','dev')),
 mentions text not null default '', max_per_run integer not null default 10 check(max_per_run between 1 and 100),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id),
 last_called_at timestamptz, consecutive_failures integer not null default 0, failure_alerted boolean not null default false
);
insert into public.sprout_baitoru_settings(id,mentions) values(true,'[To:2746758][To:4958142][To:7189401][To:8325545][To:10329028][To:11503467]');
create table public.sprout_baitoru_runs (
 id bigint generated always as identity primary key, started_at timestamptz not null default now(), finished_at timestamptz,
 counts jsonb not null default '{}', dedup_by_reason jsonb not null default '{}', error text, dry_run boolean not null default false
);
alter table public.sprout_baitoru_settings enable row level security;
alter table public.sprout_baitoru_runs enable row level security;
create policy baitoru_settings_read on public.sprout_baitoru_settings for select to authenticated using(public.root_is_super_admin());
create policy baitoru_settings_update on public.sprout_baitoru_settings for update to authenticated using(public.root_is_super_admin()) with check(public.root_is_super_admin());
create policy baitoru_runs_read on public.sprout_baitoru_runs for select to authenticated using(public.root_is_super_admin());
revoke all on public.sprout_baitoru_settings, public.sprout_baitoru_runs from anon, authenticated;
grant select on public.sprout_baitoru_settings, public.sprout_baitoru_runs to authenticated;
grant update(enabled,period_start,chatwork_title,exclude_inquiry_nos,notify_room,mentions,max_per_run,updated_at,updated_by) on public.sprout_baitoru_settings to authenticated;
grant all on public.sprout_baitoru_settings, public.sprout_baitoru_runs to service_role;
grant usage,select on sequence public.sprout_baitoru_runs_id_seq to service_role;
commit;
