alter table public.bud_expense_requests
  add column if not exists applicant_name_text text;

comment on column public.bud_expense_requests.applicant_name_text is
  '社員名簿と紐づかない経費の申請者氏名。名簿と両方ある場合は名簿を優先する';

-- Garden の通常申請は従来どおり applicant_employee_id のみを書き込む。
-- RLS は既存の bud_expense_requests ポリシーをそのまま利用する。
