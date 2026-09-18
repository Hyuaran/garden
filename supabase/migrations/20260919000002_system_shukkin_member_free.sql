do $$
declare
  constraint_name text;
begin
  select c.conname
    into constraint_name
  from pg_constraint c
  join pg_class t on t.oid = c.conrelid
  join pg_namespace n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname = 'system_shukkin_member'
    and c.conname = 'system_shukkin_member_employee_number_fkey';

  if constraint_name is not null then
    execute format('alter table public.system_shukkin_member drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.system_shukkin_member
  add column if not exists display_name text null;

insert into public.system_shukkin_member (employee_number, group_name, sort_order, active, display_name)
values
  ('1510','石原チーム',30,true,'谷本 結那'),
  ('1555','小泉チーム',20,true,'梶野 恵園'),
  ('1556','石原チーム',70,true,'藤田 悠誠')
on conflict (employee_number) do update set
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  active = true,
  display_name = excluded.display_name;
