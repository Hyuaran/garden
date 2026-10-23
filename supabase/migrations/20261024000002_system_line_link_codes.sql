create table public.system_line_link_codes (
  id bigint generated always as identity primary key,
  employee_id text not null references public.root_employees(employee_id),
  code text not null check (code ~ '^[A-HJ-NP-Z2-9]{4}$'),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.system_line_link_codes(employee_id, created_at desc);
alter table public.system_line_link_codes enable row level security;
revoke all on public.system_line_link_codes from anon, authenticated;
grant select on public.system_line_link_codes to authenticated;
create policy line_link_codes_self_select on public.system_line_link_codes for select to authenticated
using (exists (select 1 from public.root_employees e where e.employee_id = system_line_link_codes.employee_id and e.user_id = auth.uid() and e.is_active and e.deleted_at is null));

-- Both operations serialize on the employee row. Consumption and replacement are one transaction.
create function public.system_issue_line_link_code(p_employee_id text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.root_employees%rowtype; c public.system_line_link_codes%rowtype;
begin
  select * into e from public.root_employees where employee_id = p_employee_id and is_active and deleted_at is null for update;
  if not found then raise exception 'employee unavailable'; end if;
  if e.line_user_id is not null then return jsonb_build_object('linked', true, 'name', coalesce(e.line_display_name, e.name)); end if;
  select * into c from public.system_line_link_codes where employee_id = e.employee_id and used_at is null and expires_at > now() order by created_at desc limit 1;
  if not found then
    -- Never reuse an old value for this employee (including consumed values).
    if exists(select 1 from public.system_line_link_codes where employee_id = e.employee_id and code = p_code) then raise exception 'code collision'; end if;
    insert into public.system_line_link_codes(employee_id, code) values(e.employee_id, p_code) returning * into c;
  end if;
  return jsonb_build_object('linked', false, 'employeeNumber', e.employee_number, 'code', c.code);
end $$;

create function public.system_consume_line_link_code(p_employee_number text, p_code text, p_line_user_id text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e public.root_employees%rowtype; c public.system_line_link_codes%rowtype;
begin
  if nullif(p_line_user_id, '') is null then return jsonb_build_object('linked', false); end if;
  -- Serialize reassignments of the same LINE account as well.
  perform pg_advisory_xact_lock(hashtextextended(p_line_user_id, 419));
  select * into e from public.root_employees where employee_number = p_employee_number and is_active and deleted_at is null for update;
  if not found then return jsonb_build_object('linked', false); end if;
  select * into c from public.system_line_link_codes where employee_id = e.employee_id and code = p_code and used_at is null and expires_at > now() for update;
  if not found then return jsonb_build_object('linked', false); end if;
  update public.root_employees set line_user_id = null, line_display_name = null, line_link_source = 'admin_unlink' where line_user_id = p_line_user_id and employee_id <> e.employee_id;
  update public.root_employees set line_user_id = p_line_user_id, line_display_name = p_display_name, line_linked_at = now(), line_link_source = 'self' where employee_id = e.employee_id;
  update public.system_line_link_codes set used_at = now() where id = c.id;
  delete from public.system_line_staff_pending where line_user_id = p_line_user_id;
  return jsonb_build_object('linked', true, 'name', e.name);
end $$;
revoke all on function public.system_issue_line_link_code(text,text) from public, anon, authenticated;
revoke all on function public.system_consume_line_link_code(text,text,text,text) from public, anon, authenticated;
grant execute on function public.system_issue_line_link_code(text,text) to service_role;
grant execute on function public.system_consume_line_link_code(text,text,text,text) to service_role;
