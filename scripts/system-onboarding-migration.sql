-- Codex-262: ファイル作成のみ。本番へ適用しない。承認後に別途実行する。
-- 参照先の一意性: scripts/root-schema.sql の employee_id text PRIMARY KEY と
-- Codex-215 差し戻し §7 の実DB確認記録に基づく。本番の再照会・スキーマ変更は行わない。
begin;

create table if not exists public.system_onboarding (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null unique references public.root_employees(employee_id),
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  name text, name_kana text, gender text, birth_date date,
  postal_code text, address text, address_kana text, phone text,
  dependents jsonb not null default '[]'::jsonb check (jsonb_typeof(dependents) = 'array'),
  pension_number text, employment_insurance_status text, employment_insurance_number text,
  previous_employer text, previous_employer_from date, previous_employer_to date,
  emergency_name text, emergency_relation text, emergency_address text, emergency_phone text,
  nda_agreed_at timestamptz, submitted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- JSONも保存可能な項目を限定する。追加の任意項目を入れる汎用payloadにはしない。
create or replace function public.system_onboarding_dependents_valid(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(value) <> 'array' then false else
    jsonb_array_length(value) <= 30 and not exists (
      select 1 from jsonb_array_elements(value) item where
      case when jsonb_typeof(item) <> 'object' then true else
        exists (select 1 from jsonb_each(item) entry where
          entry.key not in ('name','name_kana','relation','birth_date','annual_income','occupation')
          or jsonb_typeof(entry.value) <> 'string')
      end
    ) end;
$$;
alter table public.system_onboarding add constraint system_onboarding_dependents_fields
  check (public.system_onboarding_dependents_valid(dependents));

create or replace function public.system_onboarding_before_write()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if TG_OP = 'UPDATE' then
    if OLD.status = 'submitted' then raise exception 'submitted record is read only' using errcode = '42501'; end if;
    if NEW.id <> OLD.id or NEW.employee_id <> OLD.employee_id then raise exception 'identity is immutable' using errcode = '42501'; end if;
    NEW.created_at := OLD.created_at;
    if NEW.nda_agreed_at is not null then NEW.nda_agreed_at := coalesce(OLD.nda_agreed_at, now()); end if;
  else
    NEW.created_at := now();
    if NEW.nda_agreed_at is not null then NEW.nda_agreed_at := now(); end if;
  end if;
  NEW.updated_at := now();
  NEW.submitted_at := case when NEW.status = 'submitted' then now() else null end;
  return NEW;
end;
$$;
create trigger system_onboarding_write_guard before insert or update on public.system_onboarding
  for each row execute function public.system_onboarding_before_write();

alter table public.system_onboarding enable row level security;
revoke all on public.system_onboarding from anon, authenticated;
grant select, insert, update on public.system_onboarding to authenticated;

create policy system_onboarding_own_select on public.system_onboarding for select to authenticated
  using (exists (select 1 from public.root_employees e where e.employee_id = system_onboarding.employee_id and e.user_id = auth.uid() and e.is_active and e.deleted_at is null));
create policy system_onboarding_own_insert on public.system_onboarding for insert to authenticated
  with check (exists (select 1 from public.root_employees e where e.employee_id = system_onboarding.employee_id and e.user_id = auth.uid() and e.is_active and e.deleted_at is null));
create policy system_onboarding_own_update on public.system_onboarding for update to authenticated
  using (status = 'draft' and exists (select 1 from public.root_employees e where e.employee_id = system_onboarding.employee_id and e.user_id = auth.uid() and e.is_active and e.deleted_at is null))
  with check (exists (select 1 from public.root_employees e where e.employee_id = system_onboarding.employee_id and e.user_id = auth.uid() and e.is_active and e.deleted_at is null));

comment on table public.system_onboarding is '本人の入社手続き。下書き保存と提出のみ。書類生成・従業員台帳更新は別工程。';
commit;
