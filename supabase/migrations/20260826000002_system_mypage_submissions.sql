create table if not exists public.system_mypage_submissions (
 id uuid primary key default gen_random_uuid(), employee_id text not null references public.root_employees(employee_id),
 submission_type text not null check(submission_type in('emergency_contact','commute_route','bank_account','resignation','nda')),
 payload jsonb not null default '{}'::jsonb, status text not null default 'received' check(status in('received','in_progress','amount_proposing','awaiting_employee','completed','confirmed','withdrawn')),
 proposed_one_way integer check(proposed_one_way is null or proposed_one_way>=0), handled_by uuid references auth.users(id), handled_at timestamptz,
 kintone_status text not null default 'not_applicable' check(kintone_status in('not_applicable','pending','synced','skipped','failed')),
 kintone_note text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists idx_mypage_submissions_employee on public.system_mypage_submissions(employee_id,created_at desc);
create index if not exists idx_mypage_submissions_inbox on public.system_mypage_submissions(status,created_at desc);
alter table public.system_mypage_submissions enable row level security;
revoke all on public.system_mypage_submissions from anon,authenticated;
grant all on public.system_mypage_submissions to service_role;
drop trigger if exists system_mypage_submissions_updated_at on public.system_mypage_submissions;
create trigger system_mypage_submissions_updated_at before update on public.system_mypage_submissions for each row execute function public.root_update_updated_at();
