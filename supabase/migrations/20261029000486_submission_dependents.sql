-- Creation only. No new polling or cron (0 requests/day).
alter table public.system_mypage_submissions
  drop constraint if exists system_mypage_submissions_submission_type_check;
alter table public.system_mypage_submissions
  add constraint system_mypage_submissions_submission_type_check
  check (submission_type in ('emergency_contact', 'commute_route', 'bank_account', 'resignation', 'nda', 'dependents'));
