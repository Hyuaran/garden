-- Apply manually after SQL review. Adds append-only employee profile history storage.
create extension if not exists pgcrypto;

create table if not exists public.root_employee_roster_snapshot (
  id bigserial primary key,
  employee_id text not null references public.root_employees(employee_id) on delete cascade,
  roster_record_id text,
  snapshot jsonb not null default '{}'::jsonb,
  snapshot_hash text not null,
  taken_at timestamptz not null default now()
);

create index if not exists idx_root_employee_roster_snapshot_employee_taken
  on public.root_employee_roster_snapshot (employee_id, taken_at desc);

alter table public.root_employee_roster_snapshot enable row level security;
revoke all on table public.root_employee_roster_snapshot from public, anon, authenticated;
grant all on table public.root_employee_roster_snapshot to service_role;

comment on table public.root_employee_roster_snapshot is
  'Kintone 従業員名簿の全項目スナップショット。マイナンバーは伏せ字で保存し、同一ハッシュの日は追加しない。';
comment on column public.root_employee_roster_snapshot.employee_id is 'Root 従業員ID。';
comment on column public.root_employee_roster_snapshot.roster_record_id is 'Kintone 従業員名簿のレコード番号。';
comment on column public.root_employee_roster_snapshot.snapshot is '名簿フィールドコードをキーにした Kintone value の写し。';
comment on column public.root_employee_roster_snapshot.snapshot_hash is 'snapshot の安定化 JSON に対する sha256。';
comment on column public.root_employee_roster_snapshot.taken_at is 'スナップショットを取得した日時。';

create table if not exists public.root_employee_roster_field_labels (
  field_code text primary key,
  label text not null,
  field_type text not null,
  updated_at timestamptz not null default now()
);

alter table public.root_employee_roster_field_labels enable row level security;
revoke all on table public.root_employee_roster_field_labels from public, anon, authenticated;
grant all on table public.root_employee_roster_field_labels to service_role;

comment on table public.root_employee_roster_field_labels is
  'Kintone 従業員名簿のフィールドコード、ラベル、型の対応表。同期時に fields.json から更新する。';
comment on column public.root_employee_roster_field_labels.field_code is 'Kintone のフィールドコード。';
comment on column public.root_employee_roster_field_labels.label is 'Kintone 画面上のラベル。';
comment on column public.root_employee_roster_field_labels.field_type is 'Kintone のフィールド型。';
comment on column public.root_employee_roster_field_labels.updated_at is '対応表を最後に同期した日時。';

create table if not exists public.root_employee_profile_history (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null references public.root_employees(employee_id) on delete cascade,
  category text not null check (category in (
    'address',
    'contact',
    'emergency_contact',
    'bank_account',
    'commute',
    'employment',
    'dependents',
    'my_number_status'
  )),
  payload jsonb not null default '{}'::jsonb,
  source text not null check (source in (
    'roster',
    'bank_list',
    'transfer_group',
    'mf_contract',
    'employee_confirm',
    'submission',
    'onboarding',
    'admin'
  )),
  source_ref text,
  source_document_url text,
  effective_from date,
  recorded_at timestamptz not null default now(),
  recorded_by text,
  confirmed_by_employee_at timestamptz,
  note text
);

create index if not exists idx_root_employee_profile_history_employee_category_recorded
  on public.root_employee_profile_history (employee_id, category, recorded_at desc);

alter table public.root_employee_profile_history enable row level security;
revoke all on table public.root_employee_profile_history from public, anon, authenticated;
grant select on table public.root_employee_profile_history to authenticated;
grant all on table public.root_employee_profile_history to service_role;

drop policy if exists root_employee_profile_history_self_select on public.root_employee_profile_history;
create policy root_employee_profile_history_self_select
  on public.root_employee_profile_history
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.root_employees e
      where e.employee_id = root_employee_profile_history.employee_id
        and e.user_id = auth.uid()
        and e.is_active = true
        and e.deleted_at is null
    )
  );

drop policy if exists root_employee_profile_history_writer_select on public.root_employee_profile_history;
create policy root_employee_profile_history_writer_select
  on public.root_employee_profile_history
  for select
  to authenticated
  using (public.root_can_write());

comment on table public.root_employee_profile_history is
  '従業員情報を区分ごとに追記で保持する履歴表。更新・削除は禁止し、今の値は最新行から読む。';
comment on column public.root_employee_profile_history.employee_id is 'Root 従業員ID。';
comment on column public.root_employee_profile_history.category is '住所、連絡先、口座、交通費、雇用条件などの区分。';
comment on column public.root_employee_profile_history.payload is '区分ごとに定義したキーを持つ値。口座番号などの機微情報を含む。';
comment on column public.root_employee_profile_history.source is '値の出どころ。従業員名簿、口座一覧、MF 電子契約、本人確認など。';
comment on column public.root_employee_profile_history.source_ref is '元レコード番号、PDF パス、届出 ID など。';
comment on column public.root_employee_profile_history.source_document_url is '元資料の URL。無ければ null。';
comment on column public.root_employee_profile_history.effective_from is '値が有効になる日。分からない場合は登録日。';
comment on column public.root_employee_profile_history.recorded_at is '履歴に記録した日時。';
comment on column public.root_employee_profile_history.recorded_by is '同期、Claude、本人、事務などの登録者。';
comment on column public.root_employee_profile_history.confirmed_by_employee_at is '本人が確認した日時。';
comment on column public.root_employee_profile_history.note is '食い違いや補足の説明。';

create or replace function public.root_employee_profile_forbid_change()
returns trigger
language plpgsql
as $$
begin
  raise exception '履歴は上書き・削除しません';
end;
$$;

drop trigger if exists root_employee_profile_history_no_update on public.root_employee_profile_history;
create trigger root_employee_profile_history_no_update
before update on public.root_employee_profile_history
for each row execute function public.root_employee_profile_forbid_change();

drop trigger if exists root_employee_profile_history_no_delete on public.root_employee_profile_history;
create trigger root_employee_profile_history_no_delete
before delete on public.root_employee_profile_history
for each row execute function public.root_employee_profile_forbid_change();

create or replace view public.root_employee_profile_current
with (security_invoker = true)
as
select distinct on (employee_id, category)
  id,
  employee_id,
  category,
  payload,
  source,
  source_ref,
  source_document_url,
  effective_from,
  recorded_at,
  recorded_by,
  confirmed_by_employee_at,
  note
from public.root_employee_profile_history
order by employee_id, category, recorded_at desc, id desc;

grant select on public.root_employee_profile_current to authenticated;
grant all on public.root_employee_profile_current to service_role;

comment on view public.root_employee_profile_current is
  '従業員IDと区分ごとの最新履歴行。画面と既存列同期はこのビュー相当の値を見る。';

create or replace function public.root_employee_profile_apply_current()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p jsonb;
  latest_category text;
  next_daily integer;
  next_cap integer;
begin
  select h.payload, h.category
    into p, latest_category
    from public.root_employee_profile_history h
    where h.employee_id = new.employee_id
      and h.category = new.category
    order by h.recorded_at desc, h.id desc
    limit 1;

  if latest_category = 'bank_account' then
    update public.root_employees e
      set
        bank_name = coalesce(p->>'bank_name', ''),
        bank_code = coalesce(p->>'bank_code', ''),
        branch_name = coalesce(p->>'branch_name', ''),
        branch_code = coalesce(p->>'branch_code', ''),
        account_type = coalesce(p->>'account_type', ''),
        account_number = coalesce(p->>'account_number', ''),
        account_holder = coalesce(p->>'account_holder', ''),
        account_holder_kana = coalesce(p->>'holder_kana', p->>'account_holder_kana', '')
      where e.employee_id = new.employee_id
        and (
          e.bank_name is distinct from coalesce(p->>'bank_name', '')
          or e.bank_code is distinct from coalesce(p->>'bank_code', '')
          or e.branch_name is distinct from coalesce(p->>'branch_name', '')
          or e.branch_code is distinct from coalesce(p->>'branch_code', '')
          or e.account_type is distinct from coalesce(p->>'account_type', '')
          or e.account_number is distinct from coalesce(p->>'account_number', '')
          or e.account_holder is distinct from coalesce(p->>'account_holder', '')
          or e.account_holder_kana is distinct from coalesce(p->>'holder_kana', p->>'account_holder_kana', '')
        );
  elsif latest_category = 'commute' then
    next_daily := case
      when p ? 'one_way' and jsonb_typeof(p->'one_way') = 'number' then ((p->>'one_way')::numeric * 2)::integer
      else null
    end;
    next_cap := case
      when p ? 'monthly_cap' and jsonb_typeof(p->'monthly_cap') = 'number' then (p->>'monthly_cap')::integer
      else null
    end;
    update public.root_employees e
      set
        commute_daily_allowance = next_daily,
        commute_monthly_cap = next_cap
      where e.employee_id = new.employee_id
        and (
          e.commute_daily_allowance is distinct from next_daily
          or e.commute_monthly_cap is distinct from next_cap
        );
  elsif latest_category = 'contact' and nullif(p->>'email', '') is not null then
    update public.root_employees e
      set email = p->>'email'
      where e.employee_id = new.employee_id
        and e.email is distinct from p->>'email';
  end if;

  return new;
end;
$$;

drop trigger if exists root_employee_profile_history_apply_current on public.root_employee_profile_history;
create trigger root_employee_profile_history_apply_current
after insert on public.root_employee_profile_history
for each row execute function public.root_employee_profile_apply_current();

comment on function public.root_employee_profile_apply_current() is
  '履歴の最新行から root_employees の既存列へ必要な値だけを反映する。値が同じ場合は更新しない。';

alter table public.root_roster_sync_log
  add column if not exists snapshot_rows integer not null default 0,
  add column if not exists history_rows integer not null default 0,
  add column if not exists my_number_rows integer not null default 0,
  add column if not exists bank_list_rows integer not null default 0,
  add column if not exists bank_list_skipped integer not null default 0;

comment on column public.root_roster_sync_log.snapshot_rows is 'この同期で追加した名簿スナップショット行数。';
comment on column public.root_roster_sync_log.history_rows is 'この同期で追加した従業員情報履歴行数。';
comment on column public.root_roster_sync_log.my_number_rows is 'この同期で追加または更新したマイナンバー保管行数。';
comment on column public.root_roster_sync_log.bank_list_rows is 'この同期で口座一覧から追加した履歴行数。';
comment on column public.root_roster_sync_log.bank_list_skipped is 'KOTID 不足または Root 未突合でスキップした口座一覧行数。';
