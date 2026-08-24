create or replace function public.bud_expense_done_summary(
  p_booking_corp_id text default null,
  p_start date default null,
  p_end date default null
) returns table(total_count bigint, total_amount numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint,
         coalesce(sum(amount), 0)::numeric
    from public.bud_expense_requests
   where status = 'journalized'
     and deleted_at is null
     and (p_booking_corp_id is null or booking_corp_id = p_booking_corp_id)
     and (p_start is null or booking_date >= p_start)
     and (p_end is null or booking_date < p_end);
$$;

revoke all on function public.bud_expense_done_summary(text, date, date) from public;
grant execute on function public.bud_expense_done_summary(text, date, date) to authenticated;
