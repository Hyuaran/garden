alter table public.system_mypage_submissions
  add column if not exists pdf_drive_file_id text,
  add column if not exists pdf_drive_url text,
  add column if not exists pdf_status text not null default 'not_applicable'
    check (pdf_status in ('not_applicable','generated','skipped','failed')),
  add column if not exists pdf_note text;

comment on column public.system_mypage_submissions.pdf_drive_file_id is 'Google Drive file ID for the generated submission PDF';
comment on column public.system_mypage_submissions.pdf_drive_url is 'Google Drive webViewLink for staff';
comment on column public.system_mypage_submissions.pdf_status is 'PDF generation and Drive save result';
comment on column public.system_mypage_submissions.pdf_note is 'PDF generation skip or failure detail';
