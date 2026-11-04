-- サーバー管理者接続のみ。既存の希望・確定シフトは変更しない。
begin;

create table public.system_shift_submitter (
  employee_id text primary key references public.root_employees(employee_id),
  mode text not null check (mode in ('include', 'exclude')),
  updated_at timestamptz not null default now(),
  updated_by text references public.root_employees(employee_id)
);

alter table public.system_shift_submitter enable row level security;

insert into public.system_shift_submitter (employee_id, mode)
values ('EMP-1490', 'include');

commit;
