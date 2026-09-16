alter table public.root_employees drop constraint if exists root_employees_employment_type_check;

alter table public.root_employees add constraint root_employees_employment_type_check
  check (employment_type in ('正社員', 'アルバイト', 'outsource', '役員'));

comment on column public.root_employees.employment_type is
  '正社員 / アルバイト / outsource（外注） / 役員。名簿同期が名簿の雇用形態から決める';
