-- 提出後も世帯主の氏名・続柄だけは事務が入れられるようにする。
-- 提出ずみの人に、あとから項目（世帯主）を足したため、本人も事務も入れられない状態になっていた。
-- メールアドレスのとき（20260901000002）と同じ考え方で、保護そのものは変えず、
-- 除外リストに householder_name と householder_relation を加えるだけ。
begin;

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
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation';
      applicant_new := to_jsonb(NEW) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation';
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

comment on column public.system_onboarding.householder_name is '世帯主の氏名。提出後は事務が入れられる（他の本人入力項目は提出後に変更できない）。';
comment on column public.system_onboarding.householder_relation is '世帯主との続柄。提出後は事務が入れられる（他の本人入力項目は提出後に変更できない）。';

commit;
