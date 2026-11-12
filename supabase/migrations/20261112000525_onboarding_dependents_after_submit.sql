begin;

create or replace function public.system_onboarding_before_write()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  applicant_old jsonb;
  applicant_new jsonb;
begin
  if TG_OP = 'UPDATE' then
    -- service_role の移し替えのみ。番号以外の入力・提出日時は変更させない。
    if auth.role() = 'service_role'
      and (to_jsonb(NEW) - array['my_number','my_number_secret','dependents','updated_at']) = (to_jsonb(OLD) - array['my_number','my_number_secret','dependents','updated_at'])
      and (select coalesce(jsonb_agg(item - array['my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(NEW.dependents) with ordinality t(item,ord)) = (select coalesce(jsonb_agg(item - array['my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(OLD.dependents) with ordinality t(item,ord))
    then
      NEW.updated_at := now();
      return NEW;
    end if;
    if NEW.id <> OLD.id or NEW.employee_id <> OLD.employee_id then
      raise exception 'identity is immutable' using errcode = '42501';
    end if;

    if OLD.status = 'submitted' then
      applicant_old := to_jsonb(OLD) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation' - 'dependents';
      applicant_new := to_jsonb(NEW) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation' - 'dependents';
      if applicant_new <> applicant_old
        or (select coalesce(jsonb_agg(item - array['annual_income','occupation','my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(NEW.dependents) with ordinality t(item,ord))
          is distinct from (select coalesce(jsonb_agg(item - array['annual_income','occupation','my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(OLD.dependents) with ordinality t(item,ord))
        or exists (select 1 from jsonb_array_elements(NEW.dependents) with ordinality t(item,ord)
          where (item->'my_number' is distinct from OLD.dependents->(ord::int-1)->'my_number'
            or item->'my_number_secret' is distinct from OLD.dependents->(ord::int-1)->'my_number_secret')
            and coalesce(item->>'my_number','') <> '') then
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

-- サーバーで暗号化済みの値だけを受け、配列の読み取り・更新・入力記録を一つの取引で行う。
create or replace function public.save_admin_onboarding_dependent(
  p_employee_id text, p_actor text, p_index integer, p_changes jsonb, p_overwrite boolean default false
) returns void language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  family jsonb;
  person jsonb;
  actor_role text;
  secret jsonb;
begin
  select garden_role into actor_role from public.root_employees
    where employee_id = p_actor and is_active = true and deleted_at is null;
  if actor_role is null or actor_role not in ('manager','admin','super_admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_index is null or p_index < 0 or p_index >= 30 or p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'invalid dependent' using errcode = '22023';
  end if;
  if p_changes ? 'my_number_secret' then
    if actor_role <> 'super_admin' then raise exception 'not authorized' using errcode = '42501'; end if;
    secret := p_changes->'my_number_secret';
    if p_changes - array['my_number','my_number_secret'] <> '{}'::jsonb
      or p_changes->>'my_number' is distinct from ''
      or jsonb_typeof(secret) is distinct from 'object'
      or coalesce(secret->>'my_number_cipher','') = ''
      or coalesce(secret->>'my_number_iv','') = ''
      or coalesce(secret->>'my_number_tag','') = ''
      or coalesce(secret->>'my_number_last4','') !~ '^[0-9]{4}$'
      or secret->>'key_version' is distinct from '1' then
      raise exception 'invalid encrypted number' using errcode = '22023';
    end if;
  elsif p_changes - array['annual_income','occupation'] <> '{}'::jsonb or p_changes = '{}'::jsonb then
    raise exception 'invalid fields' using errcode = '22023';
  end if;
  if p_changes ? 'annual_income' and (jsonb_typeof(p_changes->'annual_income') <> 'string'
    or coalesce(p_changes->>'annual_income','') !~ '^[0-9]+$') then
    raise exception 'invalid annual income' using errcode = '22023';
  end if;
  if p_changes ? 'occupation' and (jsonb_typeof(p_changes->'occupation') <> 'string'
    or length(p_changes->>'occupation') > 2000) then
    raise exception 'invalid occupation' using errcode = '22023';
  end if;
  select dependents into family from public.system_onboarding where employee_id = p_employee_id for update;
  if not found or p_index >= jsonb_array_length(family) then
    raise exception 'dependent not found' using errcode = '22023';
  end if;
  person := family->p_index;
  if secret is not null then
    if (coalesce(person->>'my_number','') <> '' or person->'my_number_secret' is not null and person->'my_number_secret' <> 'null'::jsonb)
      and p_overwrite is not true then raise exception 'overwrite confirmation required' using errcode = '23505'; end if;
    insert into public.my_number_access_logs(actor_employee_id, employee_id, action, detail)
      values(p_actor, p_employee_id, 'confirm', '入社手続き・扶養家族' || (p_index + 1)::text || '・番号入力');
  end if;
  update public.system_onboarding set dependents = jsonb_set(family, array[p_index::text], person || p_changes)
    where employee_id = p_employee_id;
end;
$$;
revoke all on function public.save_admin_onboarding_dependent(text,text,integer,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.save_admin_onboarding_dependent(text,text,integer,jsonb,boolean) to service_role;

commit;
