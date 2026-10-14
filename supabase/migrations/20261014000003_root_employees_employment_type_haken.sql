-- 雇用形態に「派遣」を足す（2026-10-14 東海林さん指示。派遣の人＝梶野・藤田・北野が名簿同期で正社員になっていた）
alter table public.root_employees drop constraint if exists root_employees_employment_type_check;

alter table public.root_employees add constraint root_employees_employment_type_check
  check (employment_type in ('正社員', 'アルバイト', 'outsource', '役員', '派遣'));

comment on column public.root_employees.employment_type is
  '正社員 / アルバイト / outsource（外注） / 役員 / 派遣（派遣元から受け入れている人・役職はアルバイトと同じ決め方）。名簿同期が名簿の雇用形態から決める';
