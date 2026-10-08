alter table public.root_employees
  add column if not exists innovera_extension text,
  add column if not exists call_recording_access text not null default 'default';

alter table public.root_employees
  drop constraint if exists root_employees_call_recording_access_check;

alter table public.root_employees
  add constraint root_employees_call_recording_access_check
  check (call_recording_access in ('default','all','all_history_own_audio','own','none'));

create index if not exists root_employees_innovera_extension_idx
  on public.root_employees (innovera_extension)
  where innovera_extension is not null;

comment on column public.root_employees.innovera_extension is
  'INNOVERA internal extension number for matching call history and recordings to an employee.';

comment on column public.root_employees.call_recording_access is
  'Call recording permission override. default=role default / all=all calls and recordings / all_history_own_audio=all call history and own recordings / own=own calls and recordings / none=no access.';
