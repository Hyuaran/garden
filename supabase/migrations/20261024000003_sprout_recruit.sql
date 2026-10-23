begin;
create table public.sprout_applicants (
 kintone_record_id text primary key, name text not null, kana text, last_name text, first_name text,
 last_name_kana text, first_name_kana text, birthday date, gender text, phone text, email text, address text,
 applied_date date, application_methods text[], status text, interview_at timestamptz, interview_date date,
 training_at timestamptz, training_date date, hire_date date, age_group text, raw jsonb not null,
 kintone_updated_at timestamptz, imported_at timestamptz not null default now()
);
create table public.sprout_hearing_sheets (
 kintone_record_id text primary key, name text, kana text, phone text, raw jsonb not null,
 applicant_record_id text references public.sprout_applicants(kintone_record_id) on delete set null,
 imported_at timestamptz not null default now()
);
create index on public.sprout_hearing_sheets(applicant_record_id);
create table public.sprout_import_runs (
 id bigint generated always as identity primary key, started_at timestamptz not null default now(),
 finished_at timestamptz, status text not null check(status in ('running','success','failed')),
 applicant_count integer, hearing_count integer, created_by uuid references auth.users(id)
);
alter table public.sprout_applicants enable row level security;
alter table public.sprout_hearing_sheets enable row level security;
alter table public.sprout_import_runs enable row level security;
create policy sprout_applicants_read on public.sprout_applicants for select to authenticated using(public.root_is_super_admin());
create policy sprout_hearings_read on public.sprout_hearing_sheets for select to authenticated using(public.root_is_super_admin());
create policy sprout_runs_read on public.sprout_import_runs for select to authenticated using(public.root_is_super_admin());
revoke all on public.sprout_applicants, public.sprout_hearing_sheets, public.sprout_import_runs from anon, authenticated;
grant select on public.sprout_applicants, public.sprout_hearing_sheets, public.sprout_import_runs to authenticated;
grant all on public.sprout_applicants, public.sprout_hearing_sheets, public.sprout_import_runs to service_role;
grant usage, select on sequence public.sprout_import_runs_id_seq to service_role;
alter table public.system_hire_candidates add column source_applicant_id text unique;
-- Source IDs survive deletion/reimport of the applicant to prevent duplicate handoffs.
alter table public.system_hire_candidates alter column company_id drop not null;
alter table public.system_hire_candidates alter column kot_division_code drop not null;
alter table public.system_hire_candidates alter column kot_type_code drop not null;
alter table public.system_hire_candidates add constraint hire_assignment_required check (
 (company_id is not null and kot_division_code is not null and kot_type_code is not null)
 or (source_applicant_id is not null and status in ('planned','no_show'))
);
commit;
