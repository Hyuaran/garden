alter table public.soil_list_export
  add column if not exists format text not null default 'mer';

-- 5 万件を超える書き出しは電話番号を保存しない（null）。列が not null のままだと記録の保存で止まる（2026-09-13 本番で 10 万件の書き出しが失敗）
alter table public.soil_list_export
  alter column phone_numbers drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'soil_list_export_format_check'
      and conrelid = 'public.soil_list_export'::regclass
  ) then
    alter table public.soil_list_export
      add constraint soil_list_export_format_check
      check (format in ('xlsx', 'csv', 'mer'));
  end if;
end $$;

