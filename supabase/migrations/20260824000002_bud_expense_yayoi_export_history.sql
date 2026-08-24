alter table public.bud_expense_requests
  add column if not exists yayoi_exported_at timestamptz,
  add column if not exists yayoi_export_count integer not null default 0;

alter table public.bud_expense_requests
  drop constraint if exists bud_expense_requests_yayoi_export_count_nonnegative;
alter table public.bud_expense_requests
  add constraint bud_expense_requests_yayoi_export_count_nonnegative check (yayoi_export_count >= 0);

comment on column public.bud_expense_requests.yayoi_exported_at is '弥生CSVの最終エクスポート日時';
comment on column public.bud_expense_requests.yayoi_export_count is '弥生CSVのエクスポート回数';

create or replace function public.bud_record_expense_yayoi_export(
  p_ids uuid[],
  p_reexport boolean default false
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  if p_reexport then
    update public.bud_expense_requests
       set yayoi_exported_at = now(),
           yayoi_export_count = coalesce(yayoi_export_count, 0) + 1
     where id = any(p_ids)
       and status = 'journalized'
       and deleted_at is null;
  else
    update public.bud_expense_requests
       set status = 'journalized',
           journalized_by = auth.uid(),
           journalized_at = now(),
           yayoi_exported_at = now(),
           yayoi_export_count = coalesce(yayoi_export_count, 0) + 1
     where id = any(p_ids)
       and status = 'journalize_pending'
       and deleted_at is null;
  end if;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.bud_record_expense_yayoi_export(uuid[], boolean) from public;
grant execute on function public.bud_record_expense_yayoi_export(uuid[], boolean) to authenticated;
