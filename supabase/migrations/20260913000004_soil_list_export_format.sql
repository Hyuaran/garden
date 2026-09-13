alter table public.soil_list_export
  add column if not exists format text not null default 'mer';

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

