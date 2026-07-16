-- Garden Bud transfers approval / soft-delete extension
-- Apply manually in Supabase SQL Editor. This file is intentionally idempotent.

begin;

-- Approval columns approved_by / approved_at and rejection_reason already exist.
-- Add only the missing return audit and soft-delete columns.
alter table public.bud_transfers
  add column if not exists returned_by uuid references auth.users(id) on delete set null,
  add column if not exists returned_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id) on delete set null,
  add column if not exists delete_reason text;

-- If an older deployment created the UUID columns without foreign keys, add them.
do $$
begin
  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.conrelid = 'public.bud_transfers'::regclass
       and c.contype = 'f'
       and a.attname = 'returned_by'
  ) then
    alter table public.bud_transfers
      add constraint bud_transfers_returned_by_fkey
      foreign key (returned_by) references auth.users(id) on delete set null;
  end if;

  if not exists (
    select 1
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.conrelid = 'public.bud_transfers'::regclass
       and c.contype = 'f'
       and a.attname = 'deleted_by'
  ) then
    alter table public.bud_transfers
      add constraint bud_transfers_deleted_by_fkey
      foreign key (deleted_by) references auth.users(id) on delete set null;
  end if;
end
$$;

-- Preserve the existing status CHECK expression. Extend it only when a status
-- CHECK exists and either approval value is genuinely missing.
do $$
declare
  status_constraint record;
  check_expression text;
begin
  for status_constraint in
    select c.conname, pg_get_constraintdef(c.oid, true) as definition
      from pg_constraint c
      join pg_attribute a
        on a.attrelid = c.conrelid
       and a.attnum = any (c.conkey)
     where c.conrelid = 'public.bud_transfers'::regclass
       and c.contype = 'c'
       and a.attname = 'status'
  loop
    if position('承認済み' in status_constraint.definition) = 0
       or position('差戻し' in status_constraint.definition) = 0 then
      check_expression := substring(
        status_constraint.definition
        from 8
        for char_length(status_constraint.definition) - 8
      );
      execute format(
        'alter table public.bud_transfers drop constraint %I',
        status_constraint.conname
      );
      execute format(
        'alter table public.bud_transfers add constraint %I check ((%s) or status in (''承認済み'', ''差戻し''))',
        status_constraint.conname,
        check_expression
      );
    end if;
  end loop;
end
$$;

create index if not exists idx_bud_transfers_active_scheduled_date
  on public.bud_transfers (scheduled_date, transfer_id)
  where deleted_at is null;

create index if not exists idx_bud_transfers_deleted_at
  on public.bud_transfers (deleted_at desc, transfer_id)
  where deleted_at is not null;

create or replace function public.bud_transfer_soft_delete(
  p_ids text[],
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  if not public.root_is_super_admin() then
    raise exception 'super_admin権限が必要です' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception '削除対象を選択してください' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception '削除理由は必須です' using errcode = '22023';
  end if;

  update public.bud_transfers
     set deleted_at = coalesce(deleted_at, now()),
         deleted_by = auth.uid(),
         delete_reason = btrim(p_reason),
         updated_at = now()
   where transfer_id = any (p_ids)
     and deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.bud_transfer_restore(p_ids text[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  affected integer := 0;
begin
  if not public.root_is_super_admin() then
    raise exception 'super_admin権限が必要です' using errcode = '42501';
  end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 then
    raise exception '復元対象を選択してください' using errcode = '22023';
  end if;

  update public.bud_transfers
     set deleted_at = null,
         deleted_by = null,
         delete_reason = null,
         updated_at = now()
   where transfer_id = any (p_ids)
     and deleted_at is not null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

grant select, update on table public.bud_transfers to authenticated;

revoke all on function public.bud_transfer_soft_delete(text[], text) from public;
revoke all on function public.bud_transfer_restore(text[]) from public;
grant execute on function public.bud_transfer_soft_delete(text[], text) to authenticated;
grant execute on function public.bud_transfer_restore(text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
