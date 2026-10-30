-- 2026-10-30 Claude: 検索の文字を別の表（garden_search.texts）に先に作っておき、索引で当てる。
-- 元の表の RLS（見てよい行の決まり）は当たった行にだけ効くので、索引が使える（本人の権限で読む表で 2 秒→数十ミリ秒）。
-- garden_search は API（PostgREST）に出していない schema。検索用ビュー search_v_<表>（security_invoker）からだけ使う。
CREATE SCHEMA IF NOT EXISTS garden_search;
REVOKE ALL ON SCHEMA garden_search FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA garden_search TO authenticated, service_role;
CREATE TABLE IF NOT EXISTS garden_search.texts (table_name text NOT NULL, pk text NOT NULL, search_text text NOT NULL, PRIMARY KEY (table_name, pk));
REVOKE ALL ON garden_search.texts FROM PUBLIC, anon;
GRANT SELECT ON garden_search.texts TO authenticated, service_role;
CREATE INDEX IF NOT EXISTS texts_search_trgm_idx ON garden_search.texts USING gin (search_text public.gin_trgm_ops);

-- root_companies
CREATE OR REPLACE FUNCTION garden_search.sync_root_companies() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_companies' AND pk = (SELECT t.company_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_companies' AND pk = (SELECT t.company_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_companies', t.company_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(default_bank), false), search_norm(garden_search_value(company_name), false), search_norm(garden_search_value(company_name_kana), false), search_norm(garden_search_value(phone), true), search_norm(garden_search_value(fax), true), search_norm(garden_search_value(fiscal_end_month), false), garden_search_date((established_on)::timestamp without time zone), search_norm(garden_search_value(established_on), false), search_norm(garden_search_value(domain), false), search_norm(garden_search_value(website), false), search_norm(garden_search_value(address), false), search_norm(garden_search_value(corporate_number), false), search_norm(garden_search_value(invoice_registration_number), false), search_norm(garden_search_value(telecom_notification_number), false), search_norm(garden_search_value(employment_insurance_number), false), search_norm(garden_search_value(labor_insurance_number), false), search_norm(garden_search_value(agency_notification_number), false), search_norm(garden_search_value(industry_classification), false), search_norm(garden_search_value(tax_office), false), search_norm(garden_search_value(representative), false), search_norm(garden_search_value(representative_kana), false), search_norm(garden_search_value(representative_gender), false), garden_search_date((representative_birthday)::timestamp without time zone), search_norm(garden_search_value(representative_birthday), false), search_norm(garden_search_value(representative_mobile), true), search_norm(garden_search_value(representative_address), false), search_norm(garden_search_value(contact1_name), false), search_norm(garden_search_value(contact1_phone), true), search_norm(garden_search_value(contact2_name), false), search_norm(garden_search_value(contact2_phone), true)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_companies: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_companies() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_companies;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_companies FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_companies();
DELETE FROM garden_search.texts WHERE table_name = 'root_companies';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_companies', t.company_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(default_bank), false), search_norm(garden_search_value(company_name), false), search_norm(garden_search_value(company_name_kana), false), search_norm(garden_search_value(phone), true), search_norm(garden_search_value(fax), true), search_norm(garden_search_value(fiscal_end_month), false), garden_search_date((established_on)::timestamp without time zone), search_norm(garden_search_value(established_on), false), search_norm(garden_search_value(domain), false), search_norm(garden_search_value(website), false), search_norm(garden_search_value(address), false), search_norm(garden_search_value(corporate_number), false), search_norm(garden_search_value(invoice_registration_number), false), search_norm(garden_search_value(telecom_notification_number), false), search_norm(garden_search_value(employment_insurance_number), false), search_norm(garden_search_value(labor_insurance_number), false), search_norm(garden_search_value(agency_notification_number), false), search_norm(garden_search_value(industry_classification), false), search_norm(garden_search_value(tax_office), false), search_norm(garden_search_value(representative), false), search_norm(garden_search_value(representative_kana), false), search_norm(garden_search_value(representative_gender), false), garden_search_date((representative_birthday)::timestamp without time zone), search_norm(garden_search_value(representative_birthday), false), search_norm(garden_search_value(representative_mobile), true), search_norm(garden_search_value(representative_address), false), search_norm(garden_search_value(contact1_name), false), search_norm(garden_search_value(contact1_phone), true), search_norm(garden_search_value(contact2_name), false), search_norm(garden_search_value(contact2_phone), true)]), '') FROM public.root_companies t;
CREATE OR REPLACE VIEW public.search_v_root_companies WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_companies t JOIN garden_search.texts s ON s.table_name = 'root_companies' AND s.pk = (t.company_id::text);
DROP INDEX IF EXISTS public.root_companies_search_trgm_idx;

-- root_vendors
CREATE OR REPLACE FUNCTION garden_search.sync_root_vendors() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_vendors' AND pk = (SELECT t.vendor_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_vendors' AND pk = (SELECT t.vendor_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_vendors', t.vendor_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(vendor_id), false), search_norm(garden_search_value(vendor_type), false), search_norm(garden_search_value(vendor_name), false), search_norm(garden_search_value(vendor_name_kana), false), search_norm(garden_search_value(bank_name), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(account_holder_kana), false), search_norm(garden_search_value(fee_bearer), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_vendors: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_vendors() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_vendors;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_vendors FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_vendors();
DELETE FROM garden_search.texts WHERE table_name = 'root_vendors';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_vendors', t.vendor_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(vendor_id), false), search_norm(garden_search_value(vendor_type), false), search_norm(garden_search_value(vendor_name), false), search_norm(garden_search_value(vendor_name_kana), false), search_norm(garden_search_value(bank_name), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(account_holder_kana), false), search_norm(garden_search_value(fee_bearer), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(notes), false)]), '') FROM public.root_vendors t;
CREATE OR REPLACE VIEW public.search_v_root_vendors WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_vendors t JOIN garden_search.texts s ON s.table_name = 'root_vendors' AND s.pk = (t.vendor_id::text);
DROP INDEX IF EXISTS public.root_vendors_search_trgm_idx;

-- root_employees
CREATE OR REPLACE FUNCTION garden_search.sync_root_employees() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employees' AND pk = (SELECT t.employee_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employees' AND pk = (SELECT t.employee_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_employees', t.employee_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false), search_norm(garden_search_value(employee_number), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(name), false), search_norm(garden_search_value(name_kana), false), search_norm(garden_search_value(line_contact_url), false), search_norm(garden_search_value(email), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(salary_system_id), false), search_norm(garden_search_value(insurance_type), false), search_norm(garden_search_value(garden_role), false), garden_search_date((hire_date)::timestamp without time zone), search_norm(garden_search_value(hire_date), false), garden_search_date((birthday)::timestamp without time zone), search_norm(garden_search_value(birthday), false), garden_search_date((termination_date)::timestamp without time zone), search_norm(garden_search_value(termination_date), false), garden_search_date((contract_end_on)::timestamp without time zone), search_norm(garden_search_value(contract_end_on), false), search_norm(garden_search_value(business), false), search_norm(garden_search_value(account_holder), false), search_norm(garden_search_value(kou_otsu), false), search_norm(garden_search_value(dependents_count), false), search_norm(garden_search_value(kot_employee_id), false), search_norm(garden_search_value(innovera_extension), false), search_norm(garden_search_value(innovera_mobile_extension), true), search_norm(garden_search_value(filemaker_employee_name), false), search_norm(garden_search_value(mf_employee_id), false), search_norm(garden_search_value(call_recording_access), false), search_norm(garden_search_value(chatwork_account_id), false), search_norm(garden_search_value(notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_employees: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_employees() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_employees;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_employees FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_employees();
DELETE FROM garden_search.texts WHERE table_name = 'root_employees';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_employees', t.employee_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false), search_norm(garden_search_value(employee_number), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(name), false), search_norm(garden_search_value(name_kana), false), search_norm(garden_search_value(line_contact_url), false), search_norm(garden_search_value(email), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(salary_system_id), false), search_norm(garden_search_value(insurance_type), false), search_norm(garden_search_value(garden_role), false), garden_search_date((hire_date)::timestamp without time zone), search_norm(garden_search_value(hire_date), false), garden_search_date((birthday)::timestamp without time zone), search_norm(garden_search_value(birthday), false), garden_search_date((termination_date)::timestamp without time zone), search_norm(garden_search_value(termination_date), false), garden_search_date((contract_end_on)::timestamp without time zone), search_norm(garden_search_value(contract_end_on), false), search_norm(garden_search_value(business), false), search_norm(garden_search_value(account_holder), false), search_norm(garden_search_value(kou_otsu), false), search_norm(garden_search_value(dependents_count), false), search_norm(garden_search_value(kot_employee_id), false), search_norm(garden_search_value(innovera_extension), false), search_norm(garden_search_value(innovera_mobile_extension), true), search_norm(garden_search_value(filemaker_employee_name), false), search_norm(garden_search_value(mf_employee_id), false), search_norm(garden_search_value(call_recording_access), false), search_norm(garden_search_value(chatwork_account_id), false), search_norm(garden_search_value(notes), false)]), '') FROM public.root_employees t;
CREATE OR REPLACE VIEW public.search_v_root_employees WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_employees t JOIN garden_search.texts s ON s.table_name = 'root_employees' AND s.pk = (t.employee_id::text);
DROP INDEX IF EXISTS public.root_employees_search_trgm_idx;

-- root_bank_accounts
CREATE OR REPLACE FUNCTION garden_search.sync_root_bank_accounts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_bank_accounts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_bank_accounts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_bank_accounts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(corp_code), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(sub_account_label), false), search_norm(garden_search_value(has_csv_export), false), search_norm(garden_search_value(needs_manual_balance), false), search_norm(garden_search_value(notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_bank_accounts: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_bank_accounts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_bank_accounts;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_bank_accounts FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_bank_accounts();
DELETE FROM garden_search.texts WHERE table_name = 'root_bank_accounts';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_bank_accounts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(corp_code), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(sub_account_label), false), search_norm(garden_search_value(has_csv_export), false), search_norm(garden_search_value(needs_manual_balance), false), search_norm(garden_search_value(notes), false)]), '') FROM public.root_bank_accounts t;
CREATE OR REPLACE VIEW public.search_v_root_bank_accounts WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_bank_accounts t JOIN garden_search.texts s ON s.table_name = 'root_bank_accounts' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_bank_accounts_search_trgm_idx;

-- root_salary_systems
CREATE OR REPLACE FUNCTION garden_search.sync_root_salary_systems() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_salary_systems' AND pk = (SELECT t.salary_system_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_salary_systems' AND pk = (SELECT t.salary_system_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_salary_systems', t.salary_system_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(salary_system_id), false), search_norm(garden_search_value(system_name), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(base_salary_type), false), search_norm(garden_search_value(working_hours_day), false), search_norm(garden_search_value(working_days_month), false), search_norm(garden_search_value(overtime_rate), false), search_norm(garden_search_value(night_overtime_rate), false), search_norm(garden_search_value(holiday_overtime_rate), false), search_norm(garden_search_value(notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_salary_systems: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_salary_systems() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_salary_systems;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_salary_systems FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_salary_systems();
DELETE FROM garden_search.texts WHERE table_name = 'root_salary_systems';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_salary_systems', t.salary_system_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(salary_system_id), false), search_norm(garden_search_value(system_name), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(base_salary_type), false), search_norm(garden_search_value(working_hours_day), false), search_norm(garden_search_value(working_days_month), false), search_norm(garden_search_value(overtime_rate), false), search_norm(garden_search_value(night_overtime_rate), false), search_norm(garden_search_value(holiday_overtime_rate), false), search_norm(garden_search_value(notes), false)]), '') FROM public.root_salary_systems t;
CREATE OR REPLACE VIEW public.search_v_root_salary_systems WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_salary_systems t JOIN garden_search.texts s ON s.table_name = 'root_salary_systems' AND s.pk = (t.salary_system_id::text);
DROP INDEX IF EXISTS public.root_salary_systems_search_trgm_idx;

-- root_insurance
CREATE OR REPLACE FUNCTION garden_search.sync_root_insurance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_insurance' AND pk = (SELECT t.insurance_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_insurance' AND pk = (SELECT t.insurance_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_insurance', t.insurance_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(insurance_id), false), search_norm(garden_search_value(fiscal_year), false), garden_search_date((effective_from)::timestamp without time zone), search_norm(garden_search_value(effective_from), false), garden_search_date((effective_to)::timestamp without time zone), search_norm(garden_search_value(effective_to), false), search_norm(garden_search_value(health_insurance_rate), false), search_norm(garden_search_value(nursing_insurance_rate), false), search_norm(garden_search_value(pension_rate), false), search_norm(garden_search_value(employment_insurance_rate), false), search_norm(garden_search_value(child_support_rate), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_insurance: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_insurance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_insurance;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_insurance FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_insurance();
DELETE FROM garden_search.texts WHERE table_name = 'root_insurance';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_insurance', t.insurance_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(insurance_id), false), search_norm(garden_search_value(fiscal_year), false), garden_search_date((effective_from)::timestamp without time zone), search_norm(garden_search_value(effective_from), false), garden_search_date((effective_to)::timestamp without time zone), search_norm(garden_search_value(effective_to), false), search_norm(garden_search_value(health_insurance_rate), false), search_norm(garden_search_value(nursing_insurance_rate), false), search_norm(garden_search_value(pension_rate), false), search_norm(garden_search_value(employment_insurance_rate), false), search_norm(garden_search_value(child_support_rate), false)]), '') FROM public.root_insurance t;
CREATE OR REPLACE VIEW public.search_v_root_insurance WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_insurance t JOIN garden_search.texts s ON s.table_name = 'root_insurance' AND s.pk = (t.insurance_id::text);
DROP INDEX IF EXISTS public.root_insurance_search_trgm_idx;

-- root_attendance
CREATE OR REPLACE FUNCTION garden_search.sync_root_attendance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_attendance' AND pk = (SELECT t.attendance_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_attendance' AND pk = (SELECT t.attendance_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_attendance', t.attendance_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(attendance_id), false), search_norm(garden_search_value(employee_id), false), search_norm(garden_search_value(target_month), false), search_norm(garden_search_value(working_days), false), search_norm(garden_search_value(absence_days), false), search_norm(garden_search_value(paid_leave_days), false), search_norm(garden_search_value(scheduled_hours), false), search_norm(garden_search_value(actual_hours), false), search_norm(garden_search_value(overtime_hours), false), search_norm(garden_search_value(legal_overtime_hours), false), search_norm(garden_search_value(night_hours), false), search_norm(garden_search_value(holiday_hours), false), search_norm(garden_search_value(late_hours), false), search_norm(garden_search_value(early_leave_hours), false), search_norm(garden_search_value(training_hours), false), search_norm(garden_search_value(office_hours), false), search_norm(garden_search_value(import_status), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_attendance: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_attendance() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_attendance;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_attendance FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_attendance();
DELETE FROM garden_search.texts WHERE table_name = 'root_attendance';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_attendance', t.attendance_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(attendance_id), false), search_norm(garden_search_value(employee_id), false), search_norm(garden_search_value(target_month), false), search_norm(garden_search_value(working_days), false), search_norm(garden_search_value(absence_days), false), search_norm(garden_search_value(paid_leave_days), false), search_norm(garden_search_value(scheduled_hours), false), search_norm(garden_search_value(actual_hours), false), search_norm(garden_search_value(overtime_hours), false), search_norm(garden_search_value(legal_overtime_hours), false), search_norm(garden_search_value(night_hours), false), search_norm(garden_search_value(holiday_hours), false), search_norm(garden_search_value(late_hours), false), search_norm(garden_search_value(early_leave_hours), false), search_norm(garden_search_value(training_hours), false), search_norm(garden_search_value(office_hours), false), search_norm(garden_search_value(import_status), false)]), '') FROM public.root_attendance t;
CREATE OR REPLACE VIEW public.search_v_root_attendance WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_attendance t JOIN garden_search.texts s ON s.table_name = 'root_attendance' AND s.pk = (t.attendance_id::text);
DROP INDEX IF EXISTS public.root_attendance_search_trgm_idx;

-- root_employee_team_history
CREATE OR REPLACE FUNCTION garden_search.sync_root_employee_team_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employee_team_history' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employee_team_history' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_employee_team_history', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((effective_date)::timestamp without time zone), search_norm(garden_search_value(effective_date), false), search_norm(garden_search_value(team), false), search_norm(garden_search_value(memo), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_employee_team_history: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_employee_team_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_employee_team_history;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_employee_team_history FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_employee_team_history();
DELETE FROM garden_search.texts WHERE table_name = 'root_employee_team_history';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_employee_team_history', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((effective_date)::timestamp without time zone), search_norm(garden_search_value(effective_date), false), search_norm(garden_search_value(team), false), search_norm(garden_search_value(memo), false)]), '') FROM public.root_employee_team_history t;
CREATE OR REPLACE VIEW public.search_v_root_employee_team_history WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_employee_team_history t JOIN garden_search.texts s ON s.table_name = 'root_employee_team_history' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_employee_team_history_search_trgm_idx;

-- root_employee_profile_history
CREATE OR REPLACE FUNCTION garden_search.sync_root_employee_profile_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employee_profile_history' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_employee_profile_history' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_employee_profile_history', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm((payload ->> 'bank_name'::text), false), search_norm((payload ->> 'bank_code'::text), false), search_norm((payload ->> 'account_type'::text), false), search_norm((payload ->> 'branch_name'::text), false), search_norm((payload ->> 'branch_code'::text), false), search_norm((payload ->> 'holder_kana'::text), false), search_norm((payload ->> 'postal_code'::text), false), search_norm((payload ->> 'prefecture'::text), false), search_norm((payload ->> 'city'::text), false), search_norm((payload ->> 'town'::text), false), search_norm((payload ->> 'building'::text), false), search_norm((payload ->> 'room'::text), false), search_norm((payload ->> 'phone'::text), true), search_norm((payload ->> 'phone_1'::text), true), search_norm((payload ->> 'phone_2'::text), true), search_norm((payload ->> 'phone_3'::text), true), search_norm(((payload -> 'sub_account'::text) ->> 'bank_name'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'bank_code'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'branch_name'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'branch_code'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'account_type'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'holder_kana'::text), false), search_norm((payload ->> 'one_way'::text), false), search_norm((payload ->> 'monthly_cap'::text), false), search_norm((payload ->> 'nearest_station'::text), false), search_norm((payload ->> 'route'::text), false), search_norm((payload ->> 'paid'::text), false), search_norm((payload ->> 'business'::text), false), search_norm((payload ->> 'department'::text), false), search_norm((payload ->> 'affiliation'::text), false), search_norm((payload ->> 'base_hourly'::text), false), search_norm((payload ->> 'training_hourly'::text), false), search_norm((payload ->> 'training_cap'::text), false), search_norm((payload ->> 'year_end_adjustment'::text), false), search_norm((payload ->> 'social_insurance'::text), false), search_norm((payload ->> 'employment_insurance'::text), false), search_norm((payload ->> 'employment_insurance_no'::text), false), search_norm((payload ->> 'pension_no'::text), false), search_norm((payload ->> 'advance_pay'::text), false), search_norm((payload ->> 'call_type'::text), false), search_norm(garden_search_value(employee_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_employee_profile_history: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_employee_profile_history() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_employee_profile_history;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_employee_profile_history FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_employee_profile_history();
DELETE FROM garden_search.texts WHERE table_name = 'root_employee_profile_history';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_employee_profile_history', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm((payload ->> 'bank_name'::text), false), search_norm((payload ->> 'bank_code'::text), false), search_norm((payload ->> 'account_type'::text), false), search_norm((payload ->> 'branch_name'::text), false), search_norm((payload ->> 'branch_code'::text), false), search_norm((payload ->> 'holder_kana'::text), false), search_norm((payload ->> 'postal_code'::text), false), search_norm((payload ->> 'prefecture'::text), false), search_norm((payload ->> 'city'::text), false), search_norm((payload ->> 'town'::text), false), search_norm((payload ->> 'building'::text), false), search_norm((payload ->> 'room'::text), false), search_norm((payload ->> 'phone'::text), true), search_norm((payload ->> 'phone_1'::text), true), search_norm((payload ->> 'phone_2'::text), true), search_norm((payload ->> 'phone_3'::text), true), search_norm(((payload -> 'sub_account'::text) ->> 'bank_name'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'bank_code'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'branch_name'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'branch_code'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'account_type'::text), false), search_norm(((payload -> 'sub_account'::text) ->> 'holder_kana'::text), false), search_norm((payload ->> 'one_way'::text), false), search_norm((payload ->> 'monthly_cap'::text), false), search_norm((payload ->> 'nearest_station'::text), false), search_norm((payload ->> 'route'::text), false), search_norm((payload ->> 'paid'::text), false), search_norm((payload ->> 'business'::text), false), search_norm((payload ->> 'department'::text), false), search_norm((payload ->> 'affiliation'::text), false), search_norm((payload ->> 'base_hourly'::text), false), search_norm((payload ->> 'training_hourly'::text), false), search_norm((payload ->> 'training_cap'::text), false), search_norm((payload ->> 'year_end_adjustment'::text), false), search_norm((payload ->> 'social_insurance'::text), false), search_norm((payload ->> 'employment_insurance'::text), false), search_norm((payload ->> 'employment_insurance_no'::text), false), search_norm((payload ->> 'pension_no'::text), false), search_norm((payload ->> 'advance_pay'::text), false), search_norm((payload ->> 'call_type'::text), false), search_norm(garden_search_value(employee_id), false)]), '') FROM public.root_employee_profile_history t;
CREATE OR REPLACE VIEW public.search_v_root_employee_profile_history WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_employee_profile_history t JOIN garden_search.texts s ON s.table_name = 'root_employee_profile_history' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_employee_profile_history_search_trgm_idx;

-- system_employment_contracts
CREATE OR REPLACE FUNCTION garden_search.sync_system_employment_contracts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_employment_contracts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_employment_contracts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_employment_contracts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false), search_norm((payload ->> 'kind'::text), false), search_norm((payload ->> 'salaryKind'::text), false), search_norm((payload ->> 'weeklyHours'::text), false), search_norm((payload ->> 'contractStart'::text), false), search_norm((payload ->> 'contractEnd'::text), false), search_norm((payload ->> 'hourlyWage'::text), false), search_norm((payload ->> 'concludedOn'::text), false), search_norm((payload ->> 'workLocation'::text), false), search_norm((payload ->> 'employeeAddress'::text), false), search_norm((payload ->> 'jobType'::text), false), search_norm((payload ->> 'jobTypeOther'::text), false), search_norm((payload ->> 'templateType'::text), false), search_norm((payload ->> 'indefinite'::text), false), search_norm((payload ->> 'renewalText'::text), false), search_norm((payload ->> 'commuteCap'::text), false), search_norm((payload ->> 'duties'::text), false), search_norm((payload ->> 'workHours'::text), false), search_norm((payload ->> 'fixedOvertime'::text), false), search_norm((payload ->> 'startTime'::text), false), search_norm((payload ->> 'endTime'::text), false), search_norm((payload ->> 'breakMinutes'::text), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_employment_contracts: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_employment_contracts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_employment_contracts;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_employment_contracts FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_employment_contracts();
DELETE FROM garden_search.texts WHERE table_name = 'system_employment_contracts';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_employment_contracts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false), search_norm((payload ->> 'kind'::text), false), search_norm((payload ->> 'salaryKind'::text), false), search_norm((payload ->> 'weeklyHours'::text), false), search_norm((payload ->> 'contractStart'::text), false), search_norm((payload ->> 'contractEnd'::text), false), search_norm((payload ->> 'hourlyWage'::text), false), search_norm((payload ->> 'concludedOn'::text), false), search_norm((payload ->> 'workLocation'::text), false), search_norm((payload ->> 'employeeAddress'::text), false), search_norm((payload ->> 'jobType'::text), false), search_norm((payload ->> 'jobTypeOther'::text), false), search_norm((payload ->> 'templateType'::text), false), search_norm((payload ->> 'indefinite'::text), false), search_norm((payload ->> 'renewalText'::text), false), search_norm((payload ->> 'commuteCap'::text), false), search_norm((payload ->> 'duties'::text), false), search_norm((payload ->> 'workHours'::text), false), search_norm((payload ->> 'fixedOvertime'::text), false), search_norm((payload ->> 'startTime'::text), false), search_norm((payload ->> 'endTime'::text), false), search_norm((payload ->> 'breakMinutes'::text), false)]), '') FROM public.system_employment_contracts t;
CREATE OR REPLACE VIEW public.search_v_system_employment_contracts WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_employment_contracts t JOIN garden_search.texts s ON s.table_name = 'system_employment_contracts' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_employment_contracts_search_trgm_idx;

-- system_mypage_submissions
CREATE OR REPLACE FUNCTION garden_search.sync_system_mypage_submissions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_mypage_submissions' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_mypage_submissions' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_mypage_submissions', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(proposed_one_way), false), search_norm((payload ->> 'count'::text), false), search_norm((payload ->> 'details'::text), false), search_norm((payload ->> 'effectiveDate'::text), false), search_norm((payload ->> 'note'::text), false), search_norm((payload ->> 'selfAddress'::text), false), search_norm((payload ->> 'selfPhone'::text), true), search_norm((payload ->> 'ecName'::text), false), search_norm((payload ->> 'ecRelationship'::text), false), search_norm((payload ->> 'ecAddress'::text), false), search_norm((payload ->> 'ecPhone'::text), true), search_norm((payload ->> 'kind'::text), false), search_norm((payload ->> 'station'::text), false), search_norm((payload ->> 'bankName'::text), false), search_norm((payload ->> 'bankCode'::text), false), search_norm((payload ->> 'branchName'::text), false), search_norm((payload ->> 'branchCode'::text), false), search_norm((payload ->> 'holderKana'::text), false), search_norm((payload ->> 'desiredDate'::text), false), search_norm((payload ->> 'reason'::text), false), search_norm((payload ->> 'pledgeDate'::text), false), search_norm((payload ->> 'address'::text), false), search_norm((payload ->> 'signature'::text), false), search_norm((payload ->> 'agreed'::text), false), search_norm(garden_search_value(submission_type), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_mypage_submissions: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_mypage_submissions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_mypage_submissions;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_mypage_submissions FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_mypage_submissions();
DELETE FROM garden_search.texts WHERE table_name = 'system_mypage_submissions';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_mypage_submissions', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(proposed_one_way), false), search_norm((payload ->> 'count'::text), false), search_norm((payload ->> 'details'::text), false), search_norm((payload ->> 'effectiveDate'::text), false), search_norm((payload ->> 'note'::text), false), search_norm((payload ->> 'selfAddress'::text), false), search_norm((payload ->> 'selfPhone'::text), true), search_norm((payload ->> 'ecName'::text), false), search_norm((payload ->> 'ecRelationship'::text), false), search_norm((payload ->> 'ecAddress'::text), false), search_norm((payload ->> 'ecPhone'::text), true), search_norm((payload ->> 'kind'::text), false), search_norm((payload ->> 'station'::text), false), search_norm((payload ->> 'bankName'::text), false), search_norm((payload ->> 'bankCode'::text), false), search_norm((payload ->> 'branchName'::text), false), search_norm((payload ->> 'branchCode'::text), false), search_norm((payload ->> 'holderKana'::text), false), search_norm((payload ->> 'desiredDate'::text), false), search_norm((payload ->> 'reason'::text), false), search_norm((payload ->> 'pledgeDate'::text), false), search_norm((payload ->> 'address'::text), false), search_norm((payload ->> 'signature'::text), false), search_norm((payload ->> 'agreed'::text), false), search_norm(garden_search_value(submission_type), false)]), '') FROM public.system_mypage_submissions t;
CREATE OR REPLACE VIEW public.search_v_system_mypage_submissions WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_mypage_submissions t JOIN garden_search.texts s ON s.table_name = 'system_mypage_submissions' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_mypage_submissions_search_trgm_idx;

-- system_ap_daily_report
CREATE OR REPLACE FUNCTION garden_search.sync_system_ap_daily_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_ap_daily_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_ap_daily_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_ap_daily_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((report_date)::timestamp without time zone), search_norm(garden_search_value(report_date), false), search_norm(garden_search_value(kind), false), search_norm(garden_search_value(start_time), false), search_norm(garden_search_value(end_time), false), search_norm(garden_search_value(work_minutes), false), search_norm(garden_search_value(count), false), search_norm(garden_search_value(month_total), false), search_norm(garden_search_value(coin_created), false), search_norm(garden_search_value(guide_promised), false), search_norm(garden_search_value(guide_in_progress), false), search_norm(garden_search_value(statement_check_request), false), search_norm(garden_search_value(coin_total), false), search_norm(garden_search_value(reflection), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_ap_daily_report: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_ap_daily_report() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_ap_daily_report;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_ap_daily_report FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_ap_daily_report();
DELETE FROM garden_search.texts WHERE table_name = 'system_ap_daily_report';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_ap_daily_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((report_date)::timestamp without time zone), search_norm(garden_search_value(report_date), false), search_norm(garden_search_value(kind), false), search_norm(garden_search_value(start_time), false), search_norm(garden_search_value(end_time), false), search_norm(garden_search_value(work_minutes), false), search_norm(garden_search_value(count), false), search_norm(garden_search_value(month_total), false), search_norm(garden_search_value(coin_created), false), search_norm(garden_search_value(guide_promised), false), search_norm(garden_search_value(guide_in_progress), false), search_norm(garden_search_value(statement_check_request), false), search_norm(garden_search_value(coin_total), false), search_norm(garden_search_value(reflection), false)]), '') FROM public.system_ap_daily_report t;
CREATE OR REPLACE VIEW public.search_v_system_ap_daily_report WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_ap_daily_report t JOIN garden_search.texts s ON s.table_name = 'system_ap_daily_report' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_ap_daily_report_search_trgm_idx;

-- root_payroll_notice
CREATE OR REPLACE FUNCTION garden_search.sync_root_payroll_notice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_payroll_notice' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_payroll_notice' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_payroll_notice', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(team), false), search_norm(garden_search_value(commute_flag), false), search_norm(garden_search_value(commute_people), false), search_norm(garden_search_value(training_flag), false), search_norm(garden_search_value(training_people), false), search_norm(garden_search_value(referral_flag), false), search_norm(garden_search_value(referral_people), false), search_norm(garden_search_value(other_notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_payroll_notice: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_payroll_notice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_payroll_notice;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_payroll_notice FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_payroll_notice();
DELETE FROM garden_search.texts WHERE table_name = 'root_payroll_notice';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_payroll_notice', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(team), false), search_norm(garden_search_value(commute_flag), false), search_norm(garden_search_value(commute_people), false), search_norm(garden_search_value(training_flag), false), search_norm(garden_search_value(training_people), false), search_norm(garden_search_value(referral_flag), false), search_norm(garden_search_value(referral_people), false), search_norm(garden_search_value(other_notes), false)]), '') FROM public.root_payroll_notice t;
CREATE OR REPLACE VIEW public.search_v_root_payroll_notice WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_payroll_notice t JOIN garden_search.texts s ON s.table_name = 'root_payroll_notice' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_payroll_notice_search_trgm_idx;

-- system_shukkin_member
CREATE OR REPLACE FUNCTION garden_search.sync_system_shukkin_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_shukkin_member' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_shukkin_member' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_shukkin_member', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(group_name), false), search_norm(garden_search_value(display_name), false), search_norm(garden_search_value(sort_order), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_shukkin_member: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_shukkin_member() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_shukkin_member;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_shukkin_member FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_shukkin_member();
DELETE FROM garden_search.texts WHERE table_name = 'system_shukkin_member';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_shukkin_member', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(group_name), false), search_norm(garden_search_value(display_name), false), search_norm(garden_search_value(sort_order), false)]), '') FROM public.system_shukkin_member t;
CREATE OR REPLACE VIEW public.search_v_system_shukkin_member WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_shukkin_member t JOIN garden_search.texts s ON s.table_name = 'system_shukkin_member' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_shukkin_member_search_trgm_idx;

-- system_bank_successors
CREATE OR REPLACE FUNCTION garden_search.sync_system_bank_successors() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_bank_successors' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_bank_successors' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_bank_successors', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(old_bank_code), false), search_norm(garden_search_value(old_branch_code), false), search_norm(garden_search_value(new_bank_code), false), search_norm(garden_search_value(new_branch_code), false), garden_search_date((effective_date)::timestamp without time zone), search_norm(garden_search_value(effective_date), false), search_norm(garden_search_value(note), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_bank_successors: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_bank_successors() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_bank_successors;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_bank_successors FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_bank_successors();
DELETE FROM garden_search.texts WHERE table_name = 'system_bank_successors';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_bank_successors', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(old_bank_code), false), search_norm(garden_search_value(old_branch_code), false), search_norm(garden_search_value(new_bank_code), false), search_norm(garden_search_value(new_branch_code), false), garden_search_date((effective_date)::timestamp without time zone), search_norm(garden_search_value(effective_date), false), search_norm(garden_search_value(note), false)]), '') FROM public.system_bank_successors t;
CREATE OR REPLACE VIEW public.search_v_system_bank_successors WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_bank_successors t JOIN garden_search.texts s ON s.table_name = 'system_bank_successors' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_bank_successors_search_trgm_idx;

-- root_minimum_wages
CREATE OR REPLACE FUNCTION garden_search.sync_root_minimum_wages() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_minimum_wages' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_minimum_wages' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_minimum_wages', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(prefecture), false), search_norm(garden_search_value(hourly_amount), false), garden_search_date((effective_from)::timestamp without time zone), search_norm(garden_search_value(effective_from), false), search_norm(garden_search_value(source_url), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_minimum_wages: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_minimum_wages() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_minimum_wages;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_minimum_wages FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_minimum_wages();
DELETE FROM garden_search.texts WHERE table_name = 'root_minimum_wages';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_minimum_wages', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(prefecture), false), search_norm(garden_search_value(hourly_amount), false), garden_search_date((effective_from)::timestamp without time zone), search_norm(garden_search_value(effective_from), false), search_norm(garden_search_value(source_url), false)]), '') FROM public.root_minimum_wages t;
CREATE OR REPLACE VIEW public.search_v_root_minimum_wages WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_minimum_wages t JOIN garden_search.texts s ON s.table_name = 'root_minimum_wages' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_minimum_wages_search_trgm_idx;

-- root_mail_forwardings
CREATE OR REPLACE FUNCTION garden_search.sync_root_mail_forwardings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwardings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwardings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_mail_forwardings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(holder), false), search_norm(garden_search_value(from_address), false), search_norm(garden_search_value(to_address), false), search_norm(garden_search_value(notes), false), search_norm(garden_search_value(stopped), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_mail_forwardings: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_mail_forwardings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_mail_forwardings;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_mail_forwardings FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_mail_forwardings();
DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwardings';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_mail_forwardings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(holder), false), search_norm(garden_search_value(from_address), false), search_norm(garden_search_value(to_address), false), search_norm(garden_search_value(notes), false), search_norm(garden_search_value(stopped), false)]), '') FROM public.root_mail_forwardings t;
CREATE OR REPLACE VIEW public.search_v_root_mail_forwardings WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_mail_forwardings t JOIN garden_search.texts s ON s.table_name = 'root_mail_forwardings' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_mail_forwardings_search_trgm_idx;

-- root_mail_forwarding_filings
CREATE OR REPLACE FUNCTION garden_search.sync_root_mail_forwarding_filings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwarding_filings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwarding_filings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'root_mail_forwarding_filings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((filed_on)::timestamp without time zone), search_norm(garden_search_value(filed_on), false), search_norm(garden_search_value(method), false), search_norm(garden_search_value(receipt), false), search_norm(garden_search_value(filed_by), false), search_norm(garden_search_value(notes), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on root_mail_forwarding_filings: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_root_mail_forwarding_filings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.root_mail_forwarding_filings;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.root_mail_forwarding_filings FOR EACH ROW EXECUTE FUNCTION garden_search.sync_root_mail_forwarding_filings();
DELETE FROM garden_search.texts WHERE table_name = 'root_mail_forwarding_filings';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'root_mail_forwarding_filings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((filed_on)::timestamp without time zone), search_norm(garden_search_value(filed_on), false), search_norm(garden_search_value(method), false), search_norm(garden_search_value(receipt), false), search_norm(garden_search_value(filed_by), false), search_norm(garden_search_value(notes), false)]), '') FROM public.root_mail_forwarding_filings t;
CREATE OR REPLACE VIEW public.search_v_root_mail_forwarding_filings WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.root_mail_forwarding_filings t JOIN garden_search.texts s ON s.table_name = 'root_mail_forwarding_filings' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.root_mail_forwarding_filings_search_trgm_idx;

-- system_onboarding
CREATE OR REPLACE FUNCTION garden_search.sync_system_onboarding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_onboarding' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_onboarding' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_onboarding', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(name_kana), false), search_norm(garden_search_value(gender), false), garden_search_date((birth_date)::timestamp without time zone), search_norm(garden_search_value(birth_date), false), search_norm(garden_search_value(postal_code), false), search_norm(garden_search_value(address), false), search_norm(garden_search_value(address_kana), false), search_norm(garden_search_value(phone), true), search_norm(garden_search_value(email), false), search_norm(garden_search_value(householder_name), false), search_norm(garden_search_value(householder_relation), false), search_norm(garden_search_value(pension_number), false), search_norm(garden_search_value(employment_insurance_status), false), search_norm(garden_search_value(employment_insurance_number), false), search_norm(garden_search_value(previous_employer), false), garden_search_date((previous_employer_from)::timestamp without time zone), search_norm(garden_search_value(previous_employer_from), false), garden_search_date((previous_employer_to)::timestamp without time zone), search_norm(garden_search_value(previous_employer_to), false), search_norm(garden_search_value(commute_method), false), search_norm(garden_search_value(bank_name), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(account_holder_kana), false), search_norm(garden_search_value(emergency_name), false), search_norm(garden_search_value(emergency_relation), false), search_norm(garden_search_value(emergency_relation_other), false), search_norm(garden_search_value(emergency_address), false), search_norm(garden_search_value(emergency_phone), true), search_norm(garden_search_value(commute_routes), false), garden_search_date((nda_agreed_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(nda_agreed_at), false), search_norm(garden_search_value(office), false), search_norm(garden_search_value(weekly_hours), false), search_norm(garden_search_value(health_insurance), false), search_norm(garden_search_value(pension_insurance), false), search_norm(garden_search_value(employment_insurance), false), search_norm(garden_search_value(tax_class), false), search_norm(garden_search_value(salary_kind), false), search_norm(garden_search_value(base_salary), false), search_norm(garden_search_value(allowances), false), search_norm(garden_search_value(commute_cap_monthly), false), search_norm(garden_search_value(commute_fixed_monthly), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_onboarding: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_onboarding() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_onboarding;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_onboarding FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_onboarding();
DELETE FROM garden_search.texts WHERE table_name = 'system_onboarding';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_onboarding', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(name_kana), false), search_norm(garden_search_value(gender), false), garden_search_date((birth_date)::timestamp without time zone), search_norm(garden_search_value(birth_date), false), search_norm(garden_search_value(postal_code), false), search_norm(garden_search_value(address), false), search_norm(garden_search_value(address_kana), false), search_norm(garden_search_value(phone), true), search_norm(garden_search_value(email), false), search_norm(garden_search_value(householder_name), false), search_norm(garden_search_value(householder_relation), false), search_norm(garden_search_value(pension_number), false), search_norm(garden_search_value(employment_insurance_status), false), search_norm(garden_search_value(employment_insurance_number), false), search_norm(garden_search_value(previous_employer), false), garden_search_date((previous_employer_from)::timestamp without time zone), search_norm(garden_search_value(previous_employer_from), false), garden_search_date((previous_employer_to)::timestamp without time zone), search_norm(garden_search_value(previous_employer_to), false), search_norm(garden_search_value(commute_method), false), search_norm(garden_search_value(bank_name), false), search_norm(garden_search_value(bank_code), false), search_norm(garden_search_value(branch_name), false), search_norm(garden_search_value(branch_code), false), search_norm(garden_search_value(account_type), false), search_norm(garden_search_value(account_holder_kana), false), search_norm(garden_search_value(emergency_name), false), search_norm(garden_search_value(emergency_relation), false), search_norm(garden_search_value(emergency_relation_other), false), search_norm(garden_search_value(emergency_address), false), search_norm(garden_search_value(emergency_phone), true), search_norm(garden_search_value(commute_routes), false), garden_search_date((nda_agreed_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(nda_agreed_at), false), search_norm(garden_search_value(office), false), search_norm(garden_search_value(weekly_hours), false), search_norm(garden_search_value(health_insurance), false), search_norm(garden_search_value(pension_insurance), false), search_norm(garden_search_value(employment_insurance), false), search_norm(garden_search_value(tax_class), false), search_norm(garden_search_value(salary_kind), false), search_norm(garden_search_value(base_salary), false), search_norm(garden_search_value(allowances), false), search_norm(garden_search_value(commute_cap_monthly), false), search_norm(garden_search_value(commute_fixed_monthly), false)]), '') FROM public.system_onboarding t;
CREATE OR REPLACE VIEW public.search_v_system_onboarding WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_onboarding t JOIN garden_search.texts s ON s.table_name = 'system_onboarding' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_onboarding_search_trgm_idx;

-- system_hire_candidates
CREATE OR REPLACE FUNCTION garden_search.sync_system_hire_candidates() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_hire_candidates' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_hire_candidates' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_hire_candidates', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(last_name), false), search_norm(garden_search_value(first_name), false), search_norm(garden_search_value(last_name_kana), false), search_norm(garden_search_value(first_name_kana), false), garden_search_date((birthday)::timestamp without time zone), search_norm(garden_search_value(birthday), false), search_norm(garden_search_value(gender), false), garden_search_date((hire_date)::timestamp without time zone), search_norm(garden_search_value(hire_date), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(kot_division_code), false), search_norm(garden_search_value(kot_type_code), false), search_norm(garden_search_value(checklist), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_hire_candidates: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_hire_candidates() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_hire_candidates;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_hire_candidates FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_hire_candidates();
DELETE FROM garden_search.texts WHERE table_name = 'system_hire_candidates';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_hire_candidates', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(last_name), false), search_norm(garden_search_value(first_name), false), search_norm(garden_search_value(last_name_kana), false), search_norm(garden_search_value(first_name_kana), false), garden_search_date((birthday)::timestamp without time zone), search_norm(garden_search_value(birthday), false), search_norm(garden_search_value(gender), false), garden_search_date((hire_date)::timestamp without time zone), search_norm(garden_search_value(hire_date), false), search_norm(garden_search_value(employment_type), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(kot_division_code), false), search_norm(garden_search_value(kot_type_code), false), search_norm(garden_search_value(checklist), false)]), '') FROM public.system_hire_candidates t;
CREATE OR REPLACE VIEW public.search_v_system_hire_candidates WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_hire_candidates t JOIN garden_search.texts s ON s.table_name = 'system_hire_candidates' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_hire_candidates_search_trgm_idx;

-- system_expense_report
CREATE OR REPLACE FUNCTION garden_search.sync_system_expense_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_expense_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_expense_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_expense_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(form), false), search_norm(garden_search_value(business), false), search_norm(garden_search_value(payment), false), garden_search_date((paid_on)::timestamp without time zone), search_norm(garden_search_value(paid_on), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(purpose), false), search_norm(garden_search_value(purpose_detail), false), search_norm(garden_search_value(note), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_expense_report: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_expense_report() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_expense_report;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_expense_report FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_expense_report();
DELETE FROM garden_search.texts WHERE table_name = 'system_expense_report';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_expense_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(form), false), search_norm(garden_search_value(business), false), search_norm(garden_search_value(payment), false), garden_search_date((paid_on)::timestamp without time zone), search_norm(garden_search_value(paid_on), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(purpose), false), search_norm(garden_search_value(purpose_detail), false), search_norm(garden_search_value(note), false)]), '') FROM public.system_expense_report t;
CREATE OR REPLACE VIEW public.search_v_system_expense_report WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_expense_report t JOIN garden_search.texts s ON s.table_name = 'system_expense_report' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_expense_report_search_trgm_idx;

-- system_nhk_visit_report
CREATE OR REPLACE FUNCTION garden_search.sync_system_nhk_visit_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_nhk_visit_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_nhk_visit_report' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_nhk_visit_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((visit_date)::timestamp without time zone), search_norm(garden_search_value(visit_date), false), search_norm(garden_search_value(start_time), false), search_norm(garden_search_value(end_time), false), search_norm(garden_search_value(destination), false), search_norm(garden_search_value(new_ground), false), search_norm(garden_search_value(new_satellite), false), search_norm(garden_search_value(address_ground), false), search_norm(garden_search_value(address_satellite), false), search_norm(garden_search_value(bank_credit), false), search_norm(garden_search_value(transport_fee), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_nhk_visit_report: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_nhk_visit_report() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_nhk_visit_report;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_nhk_visit_report FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_nhk_visit_report();
DELETE FROM garden_search.texts WHERE table_name = 'system_nhk_visit_report';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_nhk_visit_report', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((visit_date)::timestamp without time zone), search_norm(garden_search_value(visit_date), false), search_norm(garden_search_value(start_time), false), search_norm(garden_search_value(end_time), false), search_norm(garden_search_value(destination), false), search_norm(garden_search_value(new_ground), false), search_norm(garden_search_value(new_satellite), false), search_norm(garden_search_value(address_ground), false), search_norm(garden_search_value(address_satellite), false), search_norm(garden_search_value(bank_credit), false), search_norm(garden_search_value(transport_fee), false)]), '') FROM public.system_nhk_visit_report t;
CREATE OR REPLACE VIEW public.search_v_system_nhk_visit_report WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_nhk_visit_report t JOIN garden_search.texts s ON s.table_name = 'system_nhk_visit_report' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_nhk_visit_report_search_trgm_idx;

-- system_contracts
CREATE OR REPLACE FUNCTION garden_search.sync_system_contracts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_contracts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_contracts' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_contracts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(counterparty), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(contract_type), false), garden_search_date((concluded_on)::timestamp without time zone), search_norm(garden_search_value(concluded_on), false), search_norm(garden_search_value(note), false), search_norm(garden_search_value(drive_file_id), false), search_norm(garden_search_value(product), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_contracts: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_contracts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_contracts;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_contracts FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_contracts();
DELETE FROM garden_search.texts WHERE table_name = 'system_contracts';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_contracts', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(counterparty), false), search_norm(garden_search_value(company_id), false), search_norm(garden_search_value(contract_type), false), garden_search_date((concluded_on)::timestamp without time zone), search_norm(garden_search_value(concluded_on), false), search_norm(garden_search_value(note), false), search_norm(garden_search_value(drive_file_id), false), search_norm(garden_search_value(product), false)]), '') FROM public.system_contracts t;
CREATE OR REPLACE VIEW public.search_v_system_contracts WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_contracts t JOIN garden_search.texts s ON s.table_name = 'system_contracts' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_contracts_search_trgm_idx;

-- system_dev_questions
CREATE OR REPLACE FUNCTION garden_search.sync_system_dev_questions() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_dev_questions' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_dev_questions' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_dev_questions', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(module), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(answer_type), false), search_norm(garden_search_value(options), false), search_norm(garden_search_value(answer_choice), false), search_norm(garden_search_value(answer_text_raw), false), search_norm(garden_search_value(answer_text), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_dev_questions: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_dev_questions() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_dev_questions;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_dev_questions FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_dev_questions();
DELETE FROM garden_search.texts WHERE table_name = 'system_dev_questions';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_dev_questions', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(module), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(answer_type), false), search_norm(garden_search_value(options), false), search_norm(garden_search_value(answer_choice), false), search_norm(garden_search_value(answer_text_raw), false), search_norm(garden_search_value(answer_text), false)]), '') FROM public.system_dev_questions t;
CREATE OR REPLACE VIEW public.search_v_system_dev_questions WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_dev_questions t JOIN garden_search.texts s ON s.table_name = 'system_dev_questions' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_dev_questions_search_trgm_idx;

-- system_site_news
CREATE OR REPLACE FUNCTION garden_search.sync_system_site_news() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_site_news' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_site_news' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_site_news', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(company_id), false), garden_search_date((published_on)::timestamp without time zone), search_norm(garden_search_value(published_on), false), search_norm(garden_search_value(title), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(is_published), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_site_news: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_site_news() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_site_news;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_site_news FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_site_news();
DELETE FROM garden_search.texts WHERE table_name = 'system_site_news';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_site_news', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(company_id), false), garden_search_date((published_on)::timestamp without time zone), search_norm(garden_search_value(published_on), false), search_norm(garden_search_value(title), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(is_published), false)]), '') FROM public.system_site_news t;
CREATE OR REPLACE VIEW public.search_v_system_site_news WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_site_news t JOIN garden_search.texts s ON s.table_name = 'system_site_news' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_site_news_search_trgm_idx;

-- system_kanri_person
CREATE OR REPLACE FUNCTION garden_search.sync_system_kanri_person() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_person' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_person' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_kanri_person', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(kot_name), false), search_norm(garden_search_value(team), false), search_norm(garden_search_value(department), false), search_norm(garden_search_value(employment_kind), false), search_norm(garden_search_value(base_wage), false), search_norm(garden_search_value(is_field_sales), false), search_norm(garden_search_value(active), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_kanri_person: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_kanri_person() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_kanri_person;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_kanri_person FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_kanri_person();
DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_person';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_kanri_person', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(kot_name), false), search_norm(garden_search_value(team), false), search_norm(garden_search_value(department), false), search_norm(garden_search_value(employment_kind), false), search_norm(garden_search_value(base_wage), false), search_norm(garden_search_value(is_field_sales), false), search_norm(garden_search_value(active), false)]), '') FROM public.system_kanri_person t;
CREATE OR REPLACE VIEW public.search_v_system_kanri_person WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_kanri_person t JOIN garden_search.texts s ON s.table_name = 'system_kanri_person' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_kanri_person_search_trgm_idx;

-- system_kanri_month_setting
CREATE OR REPLACE FUNCTION garden_search.sync_system_kanri_month_setting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_month_setting' AND pk = (SELECT t.year_month::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_month_setting' AND pk = (SELECT t.year_month::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_kanri_month_setting', t.year_month::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(holidays), false), search_norm(garden_search_value(year_month), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_kanri_month_setting: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_kanri_month_setting() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_kanri_month_setting;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_kanri_month_setting FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_kanri_month_setting();
DELETE FROM garden_search.texts WHERE table_name = 'system_kanri_month_setting';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_kanri_month_setting', t.year_month::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(holidays), false), search_norm(garden_search_value(year_month), false)]), '') FROM public.system_kanri_month_setting t;
CREATE OR REPLACE VIEW public.search_v_system_kanri_month_setting WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_kanri_month_setting t JOIN garden_search.texts s ON s.table_name = 'system_kanri_month_setting' AND s.pk = (t.year_month::text);
DROP INDEX IF EXISTS public.system_kanri_month_setting_search_trgm_idx;

-- soil_list_condition
CREATE OR REPLACE FUNCTION garden_search.sync_soil_list_condition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'soil_list_condition' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'soil_list_condition' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'soil_list_condition', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(condition), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on soil_list_condition: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_soil_list_condition() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.soil_list_condition;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.soil_list_condition FOR EACH ROW EXECUTE FUNCTION garden_search.sync_soil_list_condition();
DELETE FROM garden_search.texts WHERE table_name = 'soil_list_condition';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'soil_list_condition', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false), search_norm(garden_search_value(condition), false)]), '') FROM public.soil_list_condition t;
CREATE OR REPLACE VIEW public.search_v_soil_list_condition WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.soil_list_condition t JOIN garden_search.texts s ON s.table_name = 'soil_list_condition' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.soil_list_condition_search_trgm_idx;

-- soil_list_internal_block
CREATE OR REPLACE FUNCTION garden_search.sync_soil_list_internal_block() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'soil_list_internal_block' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'soil_list_internal_block' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'soil_list_internal_block', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value("電話番号"), true), search_norm(garden_search_value("理由"), false), search_norm(garden_search_value("解除理由"), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on soil_list_internal_block: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_soil_list_internal_block() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.soil_list_internal_block;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.soil_list_internal_block FOR EACH ROW EXECUTE FUNCTION garden_search.sync_soil_list_internal_block();
DELETE FROM garden_search.texts WHERE table_name = 'soil_list_internal_block';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'soil_list_internal_block', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value("電話番号"), true), search_norm(garden_search_value("理由"), false), search_norm(garden_search_value("解除理由"), false)]), '') FROM public.soil_list_internal_block t;
CREATE OR REPLACE VIEW public.search_v_soil_list_internal_block WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.soil_list_internal_block t JOIN garden_search.texts s ON s.table_name = 'soil_list_internal_block' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.soil_list_internal_block_search_trgm_idx;

-- system_line_broadcast
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_broadcast() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_broadcast' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_broadcast' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_broadcast', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(tag_ids), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_broadcast: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_broadcast() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_broadcast;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_broadcast FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_broadcast();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_broadcast';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_broadcast', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(tag_ids), false)]), '') FROM public.system_line_broadcast t;
CREATE OR REPLACE VIEW public.search_v_system_line_broadcast WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_broadcast t JOIN garden_search.texts s ON s.table_name = 'system_line_broadcast' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_line_broadcast_search_trgm_idx;

-- system_line_tag
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_tag() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_tag', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_tag: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_tag() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_tag;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_tag FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_tag();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_tag', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(name), false)]), '') FROM public.system_line_tag t;
CREATE OR REPLACE VIEW public.search_v_system_line_tag WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_tag t JOIN garden_search.texts s ON s.table_name = 'system_line_tag' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_line_tag_search_trgm_idx;

-- system_line_tag_member
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_tag_member() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag_member' AND pk = (SELECT t.employee_id::text || '|' || t.tag_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag_member' AND pk = (SELECT t.employee_id::text || '|' || t.tag_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_tag_member', t.employee_id::text || '|' || t.tag_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(tag_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_tag_member: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_tag_member() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_tag_member;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_tag_member FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_tag_member();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_tag_member';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_tag_member', t.employee_id::text || '|' || t.tag_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(tag_id), false)]), '') FROM public.system_line_tag_member t;
CREATE OR REPLACE VIEW public.search_v_system_line_tag_member WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_tag_member t JOIN garden_search.texts s ON s.table_name = 'system_line_tag_member' AND s.pk = (t.employee_id::text || '|' || t.tag_id::text);
DROP INDEX IF EXISTS public.system_line_tag_member_search_trgm_idx;

-- system_line_greeting
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_greeting() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_greeting' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_greeting' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_greeting', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employment_tag_id), false), search_norm(garden_search_value(business_tag_id), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(enabled), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_greeting: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_greeting() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_greeting;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_greeting FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_greeting();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_greeting';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_greeting', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employment_tag_id), false), search_norm(garden_search_value(business_tag_id), false), search_norm(garden_search_value(body), false), search_norm(garden_search_value(enabled), false)]), '') FROM public.system_line_greeting t;
CREATE OR REPLACE VIEW public.search_v_system_line_greeting WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_greeting t JOIN garden_search.texts s ON s.table_name = 'system_line_greeting' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_line_greeting_search_trgm_idx;

-- system_line_contact
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_contact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_contact' AND pk = (SELECT t.key::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_contact' AND pk = (SELECT t.key::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_contact', t.key::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_contact: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_contact() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_contact;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_contact FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_contact();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_contact';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_contact', t.key::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_id), false)]), '') FROM public.system_line_contact t;
CREATE OR REPLACE VIEW public.search_v_system_line_contact WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_contact t JOIN garden_search.texts s ON s.table_name = 'system_line_contact' AND s.pk = (t.key::text);
DROP INDEX IF EXISTS public.system_line_contact_search_trgm_idx;

-- system_line_target
CREATE OR REPLACE FUNCTION garden_search.sync_system_line_target() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_target' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_line_target' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_line_target', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(label), false), search_norm(garden_search_value(chatwork_room_id), false), search_norm(garden_search_value(notify_enabled), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_line_target: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_line_target() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_line_target;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_line_target FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_line_target();
DELETE FROM garden_search.texts WHERE table_name = 'system_line_target';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_line_target', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(label), false), search_norm(garden_search_value(chatwork_room_id), false), search_norm(garden_search_value(notify_enabled), false)]), '') FROM public.system_line_target t;
CREATE OR REPLACE VIEW public.search_v_system_line_target WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_line_target t JOIN garden_search.texts s ON s.table_name = 'system_line_target' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_line_target_search_trgm_idx;

-- bud_expense_requests
CREATE OR REPLACE FUNCTION garden_search.sync_bud_expense_requests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_expense_requests' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_expense_requests' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_expense_requests', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(expense_kind), false), search_norm(garden_search_value(corp_id), false), garden_search_date((receipt_date)::timestamp without time zone), search_norm(garden_search_value(receipt_date), false), search_norm(garden_search_value(receipt_time), false), search_norm(garden_search_value(store_name), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(qualified_class), false), search_norm(garden_search_value(qualified_number), false), search_norm(garden_search_value(category_id), false), search_norm(garden_search_value(description), false), search_norm(garden_search_value(receipt_rotation), false), search_norm(garden_search_value(return_reason), false), garden_search_date((booking_date)::timestamp without time zone), search_norm(garden_search_value(booking_date), false), search_norm(garden_search_value(booking_corp_id), false), search_norm(garden_search_value(fiscal_period), false), search_norm(garden_search_value(storage_path), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_expense_requests: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_expense_requests() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_expense_requests;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_expense_requests FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_expense_requests();
DELETE FROM garden_search.texts WHERE table_name = 'bud_expense_requests';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_expense_requests', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(expense_kind), false), search_norm(garden_search_value(corp_id), false), garden_search_date((receipt_date)::timestamp without time zone), search_norm(garden_search_value(receipt_date), false), search_norm(garden_search_value(receipt_time), false), search_norm(garden_search_value(store_name), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(qualified_class), false), search_norm(garden_search_value(qualified_number), false), search_norm(garden_search_value(category_id), false), search_norm(garden_search_value(description), false), search_norm(garden_search_value(receipt_rotation), false), search_norm(garden_search_value(return_reason), false), garden_search_date((booking_date)::timestamp without time zone), search_norm(garden_search_value(booking_date), false), search_norm(garden_search_value(booking_corp_id), false), search_norm(garden_search_value(fiscal_period), false), search_norm(garden_search_value(storage_path), false)]), '') FROM public.bud_expense_requests t;
CREATE OR REPLACE VIEW public.search_v_bud_expense_requests WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_expense_requests t JOIN garden_search.texts s ON s.table_name = 'bud_expense_requests' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.bud_expense_requests_search_trgm_idx;

-- bud_transfers
CREATE OR REPLACE FUNCTION garden_search.sync_bud_transfers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_transfers' AND pk = (SELECT t.transfer_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_transfers' AND pk = (SELECT t.transfer_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_transfers', t.transfer_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(data_source), false), search_norm(garden_search_value(payment_category), false), search_norm(garden_search_value(request_company_id), false), search_norm(garden_search_value(execute_company_id), false), search_norm(garden_search_value(source_account_id), false), search_norm(garden_search_value(vendor_id), false), search_norm(garden_search_value(payee_name), false), search_norm(garden_search_value(payee_bank_name), false), search_norm(garden_search_value(payee_bank_code), false), search_norm(garden_search_value(payee_branch_name), false), search_norm(garden_search_value(payee_branch_code), false), search_norm(garden_search_value(payee_account_type), false), search_norm(garden_search_value(payee_account_holder_kana), false), search_norm(garden_search_value(registered_method), false), search_norm(garden_search_value(payeasy_biller_no), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(fee_bearer), false), garden_search_date((scheduled_date)::timestamp without time zone), search_norm(garden_search_value(scheduled_date), false), garden_search_date((due_date)::timestamp without time zone), search_norm(garden_search_value(due_date), false), search_norm(garden_search_value(description), false), search_norm(garden_search_value(invoice_pdf_url), false), search_norm(garden_search_value(scan_image_url), false), search_norm(garden_search_value(cashback_applicant_name), false), search_norm(garden_search_value(cashback_applicant_name_kana), false), search_norm(garden_search_value(cashback_applicant_phone), true), search_norm(garden_search_value(cashback_product_name), false), search_norm(garden_search_value(cashback_channel_name), false), search_norm(garden_search_value(rejection_reason), false), garden_search_date((manual_paid_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(manual_paid_at), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_transfers: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_transfers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_transfers;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_transfers FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_transfers();
DELETE FROM garden_search.texts WHERE table_name = 'bud_transfers';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_transfers', t.transfer_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(data_source), false), search_norm(garden_search_value(payment_category), false), search_norm(garden_search_value(request_company_id), false), search_norm(garden_search_value(execute_company_id), false), search_norm(garden_search_value(source_account_id), false), search_norm(garden_search_value(vendor_id), false), search_norm(garden_search_value(payee_name), false), search_norm(garden_search_value(payee_bank_name), false), search_norm(garden_search_value(payee_bank_code), false), search_norm(garden_search_value(payee_branch_name), false), search_norm(garden_search_value(payee_branch_code), false), search_norm(garden_search_value(payee_account_type), false), search_norm(garden_search_value(payee_account_holder_kana), false), search_norm(garden_search_value(registered_method), false), search_norm(garden_search_value(payeasy_biller_no), false), search_norm(garden_search_value(amount), false), search_norm(garden_search_value(fee_bearer), false), garden_search_date((scheduled_date)::timestamp without time zone), search_norm(garden_search_value(scheduled_date), false), garden_search_date((due_date)::timestamp without time zone), search_norm(garden_search_value(due_date), false), search_norm(garden_search_value(description), false), search_norm(garden_search_value(invoice_pdf_url), false), search_norm(garden_search_value(scan_image_url), false), search_norm(garden_search_value(cashback_applicant_name), false), search_norm(garden_search_value(cashback_applicant_name_kana), false), search_norm(garden_search_value(cashback_applicant_phone), true), search_norm(garden_search_value(cashback_product_name), false), search_norm(garden_search_value(cashback_channel_name), false), search_norm(garden_search_value(rejection_reason), false), garden_search_date((manual_paid_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(manual_paid_at), false)]), '') FROM public.bud_transfers t;
CREATE OR REPLACE VIEW public.search_v_bud_transfers WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_transfers t JOIN garden_search.texts s ON s.table_name = 'bud_transfers' AND s.pk = (t.transfer_id::text);
DROP INDEX IF EXISTS public.bud_transfers_search_trgm_idx;

-- bud_mf_accounts
CREATE OR REPLACE FUNCTION garden_search.sync_bud_mf_accounts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_accounts' AND pk = (SELECT t.mf_account_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_accounts' AND pk = (SELECT t.mf_account_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_mf_accounts', t.mf_account_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(mail_alias), false), search_norm(garden_search_value(hidden), false), search_norm(garden_search_value(book_sub_account_name), false), search_norm(garden_search_value(balance_mode), false), search_norm(garden_search_value(anchor_balance), false), garden_search_date((anchor_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(anchor_at), false), garden_search_date((anchor_date)::timestamp without time zone), search_norm(garden_search_value(anchor_date), false), search_norm(garden_search_value(balance_note), false), search_norm(garden_search_value(visible_employee_ids), false), search_norm(garden_search_value(sort_order), false), search_norm(garden_search_value(name), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_mf_accounts: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_mf_accounts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_mf_accounts;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_mf_accounts FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_mf_accounts();
DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_accounts';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_mf_accounts', t.mf_account_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(mail_alias), false), search_norm(garden_search_value(hidden), false), search_norm(garden_search_value(book_sub_account_name), false), search_norm(garden_search_value(balance_mode), false), search_norm(garden_search_value(anchor_balance), false), garden_search_date((anchor_at AT TIME ZONE 'Asia/Tokyo'::text)), search_norm(garden_search_value(anchor_at), false), garden_search_date((anchor_date)::timestamp without time zone), search_norm(garden_search_value(anchor_date), false), search_norm(garden_search_value(balance_note), false), search_norm(garden_search_value(visible_employee_ids), false), search_norm(garden_search_value(sort_order), false), search_norm(garden_search_value(name), false)]), '') FROM public.bud_mf_accounts t;
CREATE OR REPLACE VIEW public.search_v_bud_mf_accounts WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_mf_accounts t JOIN garden_search.texts s ON s.table_name = 'bud_mf_accounts' AND s.pk = (t.mf_account_id::text);
DROP INDEX IF EXISTS public.bud_mf_accounts_search_trgm_idx;

-- bud_mf_group_viewers
CREATE OR REPLACE FUNCTION garden_search.sync_bud_mf_group_viewers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_group_viewers' AND pk = (SELECT t.kind::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_group_viewers' AND pk = (SELECT t.kind::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_mf_group_viewers', t.kind::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_ids), false), search_norm(garden_search_value(kind), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_mf_group_viewers: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_mf_group_viewers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_mf_group_viewers;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_mf_group_viewers FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_mf_group_viewers();
DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_group_viewers';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_mf_group_viewers', t.kind::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_ids), false), search_norm(garden_search_value(kind), false)]), '') FROM public.bud_mf_group_viewers t;
CREATE OR REPLACE VIEW public.search_v_bud_mf_group_viewers WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_mf_group_viewers t JOIN garden_search.texts s ON s.table_name = 'bud_mf_group_viewers' AND s.pk = (t.kind::text);
DROP INDEX IF EXISTS public.bud_mf_group_viewers_search_trgm_idx;

-- bud_mf_axis_order
CREATE OR REPLACE FUNCTION garden_search.sync_bud_mf_axis_order() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_axis_order' AND pk = (SELECT t.key::text || '|' || t.axis::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_axis_order' AND pk = (SELECT t.key::text || '|' || t.axis::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_mf_axis_order', t.key::text || '|' || t.axis::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(sort_order), false), search_norm(garden_search_value(key), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_mf_axis_order: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_mf_axis_order() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_mf_axis_order;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_mf_axis_order FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_mf_axis_order();
DELETE FROM garden_search.texts WHERE table_name = 'bud_mf_axis_order';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_mf_axis_order', t.key::text || '|' || t.axis::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(sort_order), false), search_norm(garden_search_value(key), false)]), '') FROM public.bud_mf_axis_order t;
CREATE OR REPLACE VIEW public.search_v_bud_mf_axis_order WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_mf_axis_order t JOIN garden_search.texts s ON s.table_name = 'bud_mf_axis_order' AND s.pk = (t.key::text || '|' || t.axis::text);
DROP INDEX IF EXISTS public.bud_mf_axis_order_search_trgm_idx;

-- bud_bb_viewers
CREATE OR REPLACE FUNCTION garden_search.sync_bud_bb_viewers() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_bb_viewers' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bud_bb_viewers' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bud_bb_viewers', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_ids), false), search_norm(garden_search_value(id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bud_bb_viewers: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bud_bb_viewers() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bud_bb_viewers;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bud_bb_viewers FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bud_bb_viewers();
DELETE FROM garden_search.texts WHERE table_name = 'bud_bb_viewers';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bud_bb_viewers', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(employee_ids), false), search_norm(garden_search_value(id), false)]), '') FROM public.bud_bb_viewers t;
CREATE OR REPLACE VIEW public.search_v_bud_bb_viewers WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bud_bb_viewers t JOIN garden_search.texts s ON s.table_name = 'bud_bb_viewers' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.bud_bb_viewers_search_trgm_idx;

-- sprout_baitoru_postings
CREATE OR REPLACE FUNCTION garden_search.sync_sprout_baitoru_postings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_postings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_postings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'sprout_baitoru_postings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((start_date)::timestamp without time zone), search_norm(garden_search_value(start_date), false), garden_search_date((end_date)::timestamp without time zone), search_norm(garden_search_value(end_date), false), search_norm(garden_search_value(content), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on sprout_baitoru_postings: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_sprout_baitoru_postings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.sprout_baitoru_postings;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.sprout_baitoru_postings FOR EACH ROW EXECUTE FUNCTION garden_search.sync_sprout_baitoru_postings();
DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_postings';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'sprout_baitoru_postings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[garden_search_date((start_date)::timestamp without time zone), search_norm(garden_search_value(start_date), false), garden_search_date((end_date)::timestamp without time zone), search_norm(garden_search_value(end_date), false), search_norm(garden_search_value(content), false)]), '') FROM public.sprout_baitoru_postings t;
CREATE OR REPLACE VIEW public.search_v_sprout_baitoru_postings WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.sprout_baitoru_postings t JOIN garden_search.texts s ON s.table_name = 'sprout_baitoru_postings' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.sprout_baitoru_postings_search_trgm_idx;

-- sprout_baitoru_settings
CREATE OR REPLACE FUNCTION garden_search.sync_sprout_baitoru_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_settings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_settings' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'sprout_baitoru_settings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(content_options), false), search_norm(garden_search_value(exclude_inquiry_nos), false), search_norm(garden_search_value(notify_room), false), search_norm(garden_search_value(mention_employee_ids), false), search_norm(garden_search_value(max_per_run), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on sprout_baitoru_settings: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_sprout_baitoru_settings() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.sprout_baitoru_settings;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.sprout_baitoru_settings FOR EACH ROW EXECUTE FUNCTION garden_search.sync_sprout_baitoru_settings();
DELETE FROM garden_search.texts WHERE table_name = 'sprout_baitoru_settings';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'sprout_baitoru_settings', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(content_options), false), search_norm(garden_search_value(exclude_inquiry_nos), false), search_norm(garden_search_value(notify_room), false), search_norm(garden_search_value(mention_employee_ids), false), search_norm(garden_search_value(max_per_run), false)]), '') FROM public.sprout_baitoru_settings t;
CREATE OR REPLACE VIEW public.search_v_sprout_baitoru_settings WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.sprout_baitoru_settings t JOIN garden_search.texts s ON s.table_name = 'sprout_baitoru_settings' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.sprout_baitoru_settings_search_trgm_idx;

-- bloom_monthly_digests
CREATE OR REPLACE FUNCTION garden_search.sync_bloom_monthly_digests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_monthly_digests' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_monthly_digests' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bloom_monthly_digests', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(summary), false), search_norm(garden_search_value(pages), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bloom_monthly_digests: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bloom_monthly_digests() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bloom_monthly_digests;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bloom_monthly_digests FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bloom_monthly_digests();
DELETE FROM garden_search.texts WHERE table_name = 'bloom_monthly_digests';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bloom_monthly_digests', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(title), false), search_norm(garden_search_value(summary), false), search_norm(garden_search_value(pages), false)]), '') FROM public.bloom_monthly_digests t;
CREATE OR REPLACE VIEW public.search_v_bloom_monthly_digests WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bloom_monthly_digests t JOIN garden_search.texts s ON s.table_name = 'bloom_monthly_digests' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.bloom_monthly_digests_search_trgm_idx;

-- bloom_daily_logs
CREATE OR REPLACE FUNCTION garden_search.sync_bloom_daily_logs() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_daily_logs' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_daily_logs' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bloom_daily_logs', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(planned_items), false), garden_search_date((log_date)::timestamp without time zone), search_norm(garden_search_value(log_date), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bloom_daily_logs: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bloom_daily_logs() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bloom_daily_logs;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bloom_daily_logs FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bloom_daily_logs();
DELETE FROM garden_search.texts WHERE table_name = 'bloom_daily_logs';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bloom_daily_logs', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(planned_items), false), garden_search_date((log_date)::timestamp without time zone), search_norm(garden_search_value(log_date), false)]), '') FROM public.bloom_daily_logs t;
CREATE OR REPLACE VIEW public.search_v_bloom_daily_logs WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bloom_daily_logs t JOIN garden_search.texts s ON s.table_name = 'bloom_daily_logs' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.bloom_daily_logs_search_trgm_idx;

-- bloom_ceo_status
CREATE OR REPLACE FUNCTION garden_search.sync_bloom_ceo_status() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_ceo_status' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'bloom_ceo_status' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'bloom_ceo_status', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(status), false), search_norm(garden_search_value(summary), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on bloom_ceo_status: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_bloom_ceo_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.bloom_ceo_status;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.bloom_ceo_status FOR EACH ROW EXECUTE FUNCTION garden_search.sync_bloom_ceo_status();
DELETE FROM garden_search.texts WHERE table_name = 'bloom_ceo_status';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'bloom_ceo_status', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(status), false), search_norm(garden_search_value(summary), false)]), '') FROM public.bloom_ceo_status t;
CREATE OR REPLACE VIEW public.search_v_bloom_ceo_status WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.bloom_ceo_status t JOIN garden_search.texts s ON s.table_name = 'bloom_ceo_status' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.bloom_ceo_status_search_trgm_idx;

-- shinkouki
CREATE OR REPLACE FUNCTION garden_search.sync_shinkouki() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'shinkouki' AND pk = (SELECT t.company_id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'shinkouki' AND pk = (SELECT t.company_id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'shinkouki', t.company_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(uriage), false), search_norm(garden_search_value(gaichuhi), false), search_norm(garden_search_value(rieki), false), search_norm(garden_search_value(reflected), false), search_norm(garden_search_value(zantei), false), search_norm(garden_search_value(company_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on shinkouki: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_shinkouki() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.shinkouki;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.shinkouki FOR EACH ROW EXECUTE FUNCTION garden_search.sync_shinkouki();
DELETE FROM garden_search.texts WHERE table_name = 'shinkouki';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'shinkouki', t.company_id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(uriage), false), search_norm(garden_search_value(gaichuhi), false), search_norm(garden_search_value(rieki), false), search_norm(garden_search_value(reflected), false), search_norm(garden_search_value(zantei), false), search_norm(garden_search_value(company_id), false)]), '') FROM public.shinkouki t;
CREATE OR REPLACE VIEW public.search_v_shinkouki WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.shinkouki t JOIN garden_search.texts s ON s.table_name = 'shinkouki' AND s.pk = (t.company_id::text);
DROP INDEX IF EXISTS public.shinkouki_search_trgm_idx;

-- fiscal_periods
CREATE OR REPLACE FUNCTION garden_search.sync_fiscal_periods() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'fiscal_periods' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'fiscal_periods' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'fiscal_periods', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(junshisan), false), search_norm(garden_search_value(genkin), false), search_norm(garden_search_value(yokin), false), search_norm(garden_search_value(doc_url), false), search_norm(garden_search_value(company_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on fiscal_periods: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_fiscal_periods() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.fiscal_periods;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.fiscal_periods FOR EACH ROW EXECUTE FUNCTION garden_search.sync_fiscal_periods();
DELETE FROM garden_search.texts WHERE table_name = 'fiscal_periods';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'fiscal_periods', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(junshisan), false), search_norm(garden_search_value(genkin), false), search_norm(garden_search_value(yokin), false), search_norm(garden_search_value(doc_url), false), search_norm(garden_search_value(company_id), false)]), '') FROM public.fiscal_periods t;
CREATE OR REPLACE VIEW public.search_v_fiscal_periods WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.fiscal_periods t JOIN garden_search.texts s ON s.table_name = 'fiscal_periods' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.fiscal_periods_search_trgm_idx;

-- system_innovera_daily_extension
CREATE OR REPLACE FUNCTION garden_search.sync_system_innovera_daily_extension() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_innovera_daily_extension' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_innovera_daily_extension' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_innovera_daily_extension', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(extension), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_innovera_daily_extension: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_innovera_daily_extension() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_innovera_daily_extension;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_innovera_daily_extension FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_innovera_daily_extension();
DELETE FROM garden_search.texts WHERE table_name = 'system_innovera_daily_extension';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_innovera_daily_extension', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(extension), false)]), '') FROM public.system_innovera_daily_extension t;
CREATE OR REPLACE VIEW public.search_v_system_innovera_daily_extension WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_innovera_daily_extension t JOIN garden_search.texts s ON s.table_name = 'system_innovera_daily_extension' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_innovera_daily_extension_search_trgm_idx;

-- system_zenkaku_check_request
CREATE OR REPLACE FUNCTION garden_search.sync_system_zenkaku_check_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_check_request' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_check_request' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_zenkaku_check_request', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(sales_id), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_zenkaku_check_request: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_zenkaku_check_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_zenkaku_check_request;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_zenkaku_check_request FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_zenkaku_check_request();
DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_check_request';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_zenkaku_check_request', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(sales_id), false)]), '') FROM public.system_zenkaku_check_request t;
CREATE OR REPLACE VIEW public.search_v_system_zenkaku_check_request WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_zenkaku_check_request t JOIN garden_search.texts s ON s.table_name = 'system_zenkaku_check_request' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_zenkaku_check_request_search_trgm_idx;

-- system_zenkaku_submission
CREATE OR REPLACE FUNCTION garden_search.sync_system_zenkaku_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $f$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_submission' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_submission' AND pk = (SELECT t.id::text FROM (SELECT OLD.*) t);
  END IF;
  BEGIN
    INSERT INTO garden_search.texts (table_name, pk, search_text)
      SELECT 'system_zenkaku_submission', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(selected_partner_code), false), search_norm(garden_search_value(duplicate_confirmed), false)]), '') FROM (SELECT NEW.*) t
      ON CONFLICT (table_name, pk) DO UPDATE SET search_text = EXCLUDED.search_text;
  EXCEPTION WHEN OTHERS THEN
    -- 検索の文字が作れなくても、元の表への保存は止めない
    RAISE WARNING 'garden_search sync failed on system_zenkaku_submission: %', SQLERRM;
  END;
  RETURN NEW;
END $f$;
REVOKE ALL ON FUNCTION garden_search.sync_system_zenkaku_submission() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS garden_search_sync ON public.system_zenkaku_submission;
CREATE TRIGGER garden_search_sync AFTER INSERT OR UPDATE OR DELETE ON public.system_zenkaku_submission FOR EACH ROW EXECUTE FUNCTION garden_search.sync_system_zenkaku_submission();
DELETE FROM garden_search.texts WHERE table_name = 'system_zenkaku_submission';
INSERT INTO garden_search.texts (table_name, pk, search_text) SELECT 'system_zenkaku_submission', t.id::text, coalesce(garden_search_join(VARIADIC ARRAY[search_norm(garden_search_value(selected_partner_code), false), search_norm(garden_search_value(duplicate_confirmed), false)]), '') FROM public.system_zenkaku_submission t;
CREATE OR REPLACE VIEW public.search_v_system_zenkaku_submission WITH (security_invoker = true) AS
  SELECT t.*, s.search_text FROM public.system_zenkaku_submission t JOIN garden_search.texts s ON s.table_name = 'system_zenkaku_submission' AND s.pk = (t.id::text);
DROP INDEX IF EXISTS public.system_zenkaku_submission_search_trgm_idx;
