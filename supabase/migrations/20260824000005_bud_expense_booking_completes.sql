create or replace function public.bud_complete_expense_booking(
  p_ids uuid[],
  p_booking_date date,
  p_booking_corp_id text,
  p_fiscal_periods jsonb
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  if p_booking_date is null or nullif(trim(p_booking_corp_id), '') is null then
    raise exception '仕分け日と仕分け法人名は必須です';
  end if;
  if exists (
    select 1 from unnest(p_ids) as target(id)
     where nullif(trim(p_fiscal_periods ->> target.id::text), '') is null
  ) then
    raise exception '決算区分は必須です';
  end if;
  if (
    select count(*) from public.bud_expense_requests
     where id = any(p_ids)
       and status = 'journalize_pending'
       and deleted_at is null
  ) <> cardinality(p_ids) then
    raise exception '対象外または更新済みの行が含まれています';
  end if;

  update public.bud_expense_requests
     set booking_date = p_booking_date,
         booking_corp_id = p_booking_corp_id,
         fiscal_period = nullif(p_fiscal_periods ->> id::text, ''),
         booking_set_at = now(),
         booking_set_by = auth.uid(),
         status = 'journalized',
         journalized_at = now(),
         journalized_by = auth.uid()
   where id = any(p_ids)
     and status = 'journalize_pending'
     and deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.bud_complete_expense_booking(uuid[], date, text, jsonb) from public;
grant execute on function public.bud_complete_expense_booking(uuid[], date, text, jsonb) to authenticated;

-- 2026-08-24 に仕分け情報だけ保存済みとなった行を、新しい業務遷移へ合わせる。
update public.bud_expense_requests
   set status = 'journalized',
       journalized_at = booking_set_at,
       journalized_by = booking_set_by
 where status = 'journalize_pending'
   and booking_date is not null
   and deleted_at is null;

-- CSV出力で仕訳待ちを完了へ移す旧経路を廃止し、完了行の出力記録だけに限定する。
drop function if exists public.bud_record_expense_yayoi_export(uuid[], boolean);

create function public.bud_record_expense_yayoi_export(p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
begin
  update public.bud_expense_requests
     set yayoi_exported_at = now(),
         yayoi_export_count = coalesce(yayoi_export_count, 0) + 1
   where id = any(p_ids)
     and status = 'journalized'
     and deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.bud_record_expense_yayoi_export(uuid[]) from public;
grant execute on function public.bud_record_expense_yayoi_export(uuid[]) to authenticated;
