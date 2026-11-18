alter table public.system_nhk_visit_report
  add column if not exists resume_resolved integer not null default 0,
  add column if not exists resume_collected integer not null default 0;

alter table public.system_nhk_visit_report
  drop constraint if exists system_nhk_visit_report_resume_resolved_check,
  drop constraint if exists system_nhk_visit_report_resume_collected_check;

alter table public.system_nhk_visit_report
  add constraint system_nhk_visit_report_resume_resolved_check check (resume_resolved >= 0),
  add constraint system_nhk_visit_report_resume_collected_check check (resume_collected >= 0);
