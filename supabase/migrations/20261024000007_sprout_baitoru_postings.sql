begin;
create table public.sprout_baitoru_postings (
 id uuid primary key default gen_random_uuid(),
 start_date date not null, end_date date not null check(start_date<=end_date),
 content text not null check(length(trim(content)) between 1 and 200),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id), ended_early_at timestamptz
);
alter table public.sprout_baitoru_settings add column content_options text[] not null default '{テレマアルバイト,テレマ正社員}';
insert into public.sprout_baitoru_postings(start_date,end_date,content) values('2026-09-22','2026-10-05','テレマアルバイト');
alter table public.sprout_baitoru_postings enable row level security;
create policy baitoru_postings_admin on public.sprout_baitoru_postings for all to authenticated using(public.root_is_super_admin()) with check(public.root_is_super_admin());
revoke all on public.sprout_baitoru_postings from anon,authenticated;
grant select,insert,update,delete on public.sprout_baitoru_postings to authenticated;
grant all on public.sprout_baitoru_postings to service_role;
grant update(content_options) on public.sprout_baitoru_settings to authenticated;
commit;
