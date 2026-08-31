-- Codex-266: ファイル作成のみ。本番へ適用しない。承認後に別途実行する。
-- 入社手続きに事務入力欄を追加し、責任者以上が全員分を読めるようにする。
begin;

alter table public.system_onboarding
  add column if not exists office text,
  add column if not exists weekly_hours text,
  add column if not exists health_insurance text,
  add column if not exists pension_insurance text,
  add column if not exists employment_insurance text,
  add column if not exists tax_class text,
  add column if not exists salary_kind text,
  add column if not exists base_salary text,
  add column if not exists allowances jsonb not null default '[]'::jsonb,
  add column if not exists commute_fixed_monthly text,
  add column if not exists commute_cap_monthly text,
  add column if not exists admin_updated_at timestamptz;

create or replace function public.system_onboarding_allowances_valid(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(value) <> 'array' then false else
    jsonb_array_length(value) <= 6 and not exists (
      select 1 from jsonb_array_elements(value) item where
        jsonb_typeof(item) <> 'object'
        or exists (
          select 1 from jsonb_object_keys(item) key
          where key not in ('name', 'amount')
        )
        or exists (
          select 1 from jsonb_each(item) field
          where jsonb_typeof(field.value) <> 'string'
        )
    ) end;
$$;

alter table public.system_onboarding
  drop constraint if exists system_onboarding_allowances_fields;

alter table public.system_onboarding
  add constraint system_onboarding_allowances_fields
  check (public.system_onboarding_allowances_valid(allowances));

drop policy if exists system_onboarding_manager_select on public.system_onboarding;
drop policy if exists system_onboarding_manager_insert on public.system_onboarding;
drop policy if exists system_onboarding_manager_update on public.system_onboarding;

create policy system_onboarding_manager_select on public.system_onboarding
  for select to authenticated using (public.root_can_write());

create policy system_onboarding_manager_insert on public.system_onboarding
  for insert to authenticated with check (public.root_can_write());

create policy system_onboarding_manager_update on public.system_onboarding
  for update to authenticated using (public.root_can_write()) with check (public.root_can_write());

create or replace function public.system_onboarding_before_write()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  applicant_old jsonb;
  applicant_new jsonb;
begin
  if TG_OP = 'UPDATE' then
    if NEW.id <> OLD.id or NEW.employee_id <> OLD.employee_id then
      raise exception 'identity is immutable' using errcode = '42501';
    end if;

    if OLD.status = 'submitted' then
      applicant_old := to_jsonb(OLD) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at';
      applicant_new := to_jsonb(NEW) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at';
      if applicant_new <> applicant_old then
        raise exception 'submitted applicant fields are read only' using errcode = '42501';
      end if;
      NEW.created_at := OLD.created_at;
      NEW.updated_at := now();
      NEW.nda_agreed_at := OLD.nda_agreed_at;
      NEW.submitted_at := OLD.submitted_at;
      return NEW;
    end if;

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

comment on column public.system_onboarding.allowances is '入社手続きの事務入力手当。最大6件、キーはnameとamountのみ、各値は文字列。';

commit;
