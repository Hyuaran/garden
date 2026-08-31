-- Codex-263: ファイル作成のみ。本番へ適用しない。承認後に別途実行する。
-- 入社手続きに通勤・給与受取口座・本人マイナンバーを追加し、検索用の共通マスタを作る。
begin;

alter table public.system_onboarding
  add column if not exists commute_method text,
  add column if not exists commute_station text,
  add column if not exists commute_line text,
  add column if not exists commute_pass_monthly text,
  add column if not exists commute_fare_oneway text,
  add column if not exists bank_name text,
  add column if not exists bank_code text,
  add column if not exists branch_name text,
  add column if not exists branch_code text,
  add column if not exists account_type text,
  add column if not exists account_number text,
  add column if not exists account_holder_kana text,
  add column if not exists my_number text,
  add column if not exists emergency_relation_other text;

create table if not exists public.system_bank_master (
  bank_code text primary key,
  bank_name text,
  bank_kana text
);

create table if not exists public.system_bank_branches (
  bank_code text not null,
  branch_code text not null,
  branch_name text,
  branch_kana text,
  primary key (bank_code, branch_code)
);

create table if not exists public.system_commute_fares (
  id uuid primary key default gen_random_uuid(),
  station text not null,
  line text,
  workplace text not null,
  pass_monthly integer,
  fare_oneway integer,
  updated_at timestamptz not null default now(),
  unique (station, workplace)
);

alter table public.system_bank_master enable row level security;
alter table public.system_bank_branches enable row level security;
alter table public.system_commute_fares enable row level security;

revoke all on public.system_bank_master from anon, authenticated;
revoke all on public.system_bank_branches from anon, authenticated;
revoke all on public.system_commute_fares from anon, authenticated;
grant select on public.system_bank_master to authenticated;
grant select on public.system_bank_branches to authenticated;
grant select on public.system_commute_fares to authenticated;
grant insert, update, delete on public.system_bank_master to authenticated;
grant insert, update, delete on public.system_bank_branches to authenticated;
grant insert, update, delete on public.system_commute_fares to authenticated;

drop policy if exists system_bank_master_select on public.system_bank_master;
drop policy if exists system_bank_master_write on public.system_bank_master;
drop policy if exists system_bank_branches_select on public.system_bank_branches;
drop policy if exists system_bank_branches_write on public.system_bank_branches;
drop policy if exists system_commute_fares_select on public.system_commute_fares;
drop policy if exists system_commute_fares_write on public.system_commute_fares;

create policy system_bank_master_select on public.system_bank_master
  for select to authenticated using (true);
create policy system_bank_master_write on public.system_bank_master
  for all to authenticated using (public.root_can_write()) with check (public.root_can_write());

create policy system_bank_branches_select on public.system_bank_branches
  for select to authenticated using (true);
create policy system_bank_branches_write on public.system_bank_branches
  for all to authenticated using (public.root_can_write()) with check (public.root_can_write());

create policy system_commute_fares_select on public.system_commute_fares
  for select to authenticated using (true);
create policy system_commute_fares_write on public.system_commute_fares
  for all to authenticated using (public.root_can_write()) with check (public.root_can_write());

comment on table public.system_bank_master is '入社手続きの銀行コード検索用共通マスタ。初期データは別工程で投入する。';
comment on table public.system_bank_branches is '入社手続きの支店コード検索用共通マスタ。初期データは別工程で投入する。';
comment on table public.system_commute_fares is '入社手続きの通勤交通費検索用共通マスタ。初期データは別工程で投入する。';

commit;
