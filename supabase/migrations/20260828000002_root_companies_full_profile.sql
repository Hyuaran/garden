alter table public.root_companies
  add column if not exists fax text,
  add column if not exists fiscal_end_month integer,
  add column if not exists invoice_registration_number text,
  add column if not exists telecom_notification_number text,
  add column if not exists employment_insurance_number text,
  add column if not exists labor_insurance_number text,
  add column if not exists tax_office text,
  add column if not exists agency_notification_number text,
  add column if not exists industry_classification text,
  add column if not exists domain text,
  add column if not exists representative_gender text,
  add column if not exists representative_birthday date,
  add column if not exists representative_address text,
  add column if not exists representative_mobile text,
  add column if not exists contact1_name text,
  add column if not exists contact1_phone text,
  add column if not exists contact2_name text,
  add column if not exists contact2_phone text;

alter table public.root_companies
  drop constraint if exists root_companies_fiscal_end_month_check,
  add constraint root_companies_fiscal_end_month_check
    check (fiscal_end_month between 1 and 12);
