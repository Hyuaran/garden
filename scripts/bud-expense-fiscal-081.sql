-- Codex-081: Bud expense fiscal master and qualified_class update
-- Apply manually in Supabase SQL editor.

alter table public.bud_corporations
  add column if not exists established_on date,
  add column if not exists fiscal_end_month smallint;

alter table public.bud_corporations
  drop constraint if exists bud_corporations_fiscal_end_month_check;

alter table public.bud_corporations
  add constraint bud_corporations_fiscal_end_month_check
  check (fiscal_end_month is null or fiscal_end_month between 1 and 12);

update public.bud_corporations
set established_on = v.established_on::date,
    fiscal_end_month = v.fiscal_end_month
from (
  values
    ('hyuaran',     '2016-04-08', 3),
    ('centerrise',  '2018-10-09', 8),
    ('arata',       '2019-12-03', 11),
    ('linksupport', '2020-06-08', 5),
    ('taiyou',      '2021-01-13', 1),
    ('ichi',        '2025-06-06', 5),
    ('stonebase',   '2026-06-06', 5)
) as v(id, established_on, fiscal_end_month)
where public.bud_corporations.id = v.id;

do $$
declare
  constraint_name text;
begin
  select con.conname
    into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'bud_expense_requests'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%qualified_class%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.bud_expense_requests drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.bud_expense_requests
  add constraint bud_expense_requests_qualified_class_check
  check (qualified_class is null or qualified_class in ('有', '無', '非課税'));
