-- Bud expense soft delete support.
-- Apply manually in Supabase SQL editor. This file is idempotent.

alter table public.bud_expense_requests
  add column if not exists deleted_at timestamptz;

alter table public.bud_expense_requests
  add column if not exists deleted_by uuid references auth.users(id) on delete set null;

alter table public.bud_expense_requests
  add column if not exists delete_reason text;

create index if not exists idx_bud_expense_requests_not_deleted_status
  on public.bud_expense_requests (status, corp_id, submitted_at)
  where deleted_at is null;

create index if not exists idx_bud_expense_requests_deleted_at
  on public.bud_expense_requests (deleted_at desc)
  where deleted_at is not null;

create or replace function public.bud_expense_soft_delete(p_ids uuid[], p_reason text)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer := 0;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not public.root_is_super_admin() then
    raise exception 'super_admin role is required to soft-delete expense requests'
      using errcode = '42501';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'p_ids must contain at least one expense request id'
      using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'delete reason is required'
      using errcode = '22023';
  end if;

  update public.bud_expense_requests
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = auth.uid(),
         delete_reason = v_reason,
         updated_at = now()
   where id = any(p_ids)
     and deleted_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.bud_expense_restore(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_count integer := 0;
begin
  if not public.root_is_super_admin() then
    raise exception 'super_admin role is required to restore expense requests'
      using errcode = '42501';
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    raise exception 'p_ids must contain at least one expense request id'
      using errcode = '22023';
  end if;

  update public.bud_expense_requests
     set deleted_at = null,
         deleted_by = null,
         delete_reason = null,
         updated_at = now()
   where id = any(p_ids)
     and deleted_at is not null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.bud_expense_soft_delete(uuid[], text) from public;
revoke all on function public.bud_expense_restore(uuid[]) from public;

grant execute on function public.bud_expense_soft_delete(uuid[], text) to authenticated;
grant execute on function public.bud_expense_restore(uuid[]) to authenticated;

-- Verification after apply:
-- select column_name, data_type
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'bud_expense_requests'
--    and column_name in ('deleted_at', 'deleted_by', 'delete_reason')
--  order by column_name;
--
-- select proname
--   from pg_proc
--  where proname in ('bud_expense_soft_delete', 'bud_expense_restore')
--  order by proname;
--
-- select count(*) as active_count
--   from public.bud_expense_requests
--  where deleted_at is null;
