alter table public.root_employees
  add column if not exists line_user_id text unique,
  add column if not exists line_display_name text,
  add column if not exists line_linked_at timestamptz,
  add column if not exists line_link_source text;

comment on column public.root_employees.line_user_id is 'スタッフ連絡用 LINE のユーザー ID';
comment on column public.root_employees.line_display_name is 'スタッフ連絡用 LINE の表示名';
comment on column public.root_employees.line_linked_at is 'スタッフ連絡用 LINE を紐づけた日時';
comment on column public.root_employees.line_link_source is 'スタッフ連絡用 LINE の紐づけ元（self=本人、admin=管理者、unfollowed=ブロック中、admin_unlink=管理者が解除）';

create table if not exists public.system_line_staff_pending (
  line_user_id text primary key,
  display_name text,
  last_text text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.system_line_staff_pending enable row level security;

create table if not exists public.system_line_staff_message (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  shift text not null,
  employee_id text,
  employee_number text not null,
  line_user_id text,
  message text not null,
  status text not null check (status in ('sent','failed','unlinked')),
  error text,
  sent_by_employee_id text,
  sent_at timestamptz not null default now()
);

create index if not exists system_line_staff_message_work_date_sent_at_idx
  on public.system_line_staff_message (work_date, sent_at);

alter table public.system_line_staff_message enable row level security;
