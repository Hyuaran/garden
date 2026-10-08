alter table public.root_employees add column if not exists innovera_mobile_extension text;
create index if not exists root_employees_innovera_mobile_extension_idx on public.root_employees (innovera_mobile_extension) where innovera_mobile_extension is not null;
comment on column public.root_employees.innovera_extension is 'INNOVERA の内線番号（PC 版）。発信番号の変更はこちらのユーザで行う';
comment on column public.root_employees.innovera_mobile_extension is 'INNOVERA の内線番号（モバイル版）。履歴・録音の本人判定に PC 版と合わせて使う';
