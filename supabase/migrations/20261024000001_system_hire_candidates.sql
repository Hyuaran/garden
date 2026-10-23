begin;
create table public.system_hire_candidates (
 id uuid primary key default gen_random_uuid(),
 last_name text not null, first_name text not null, last_name_kana text not null, first_name_kana text not null,
 birthday date not null, gender text not null check (gender in ('male','female')), hire_date date not null,
 employment_type text not null, company_id text not null references public.root_companies(company_id),
 kot_division_code text not null, kot_type_code text not null,
 status text not null default 'planned' check (status in ('planned','no_show','hiring','hired')),
 employee_number text unique, employee_id text, kintone_roster_record_id text,
 steps jsonb not null default '{}'::jsonb, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 processing_started_at timestamptz, processing_token uuid
);
alter table public.system_hire_candidates enable row level security;
create policy hire_candidates_select on public.system_hire_candidates for select to authenticated using (public.root_is_super_admin());
create policy hire_candidates_insert on public.system_hire_candidates for insert to authenticated with check (public.root_is_super_admin());
create policy hire_candidates_update on public.system_hire_candidates for update to authenticated using (public.root_is_super_admin()) with check (public.root_is_super_admin());
-- Serializes allocation across candidates; persisted reservations are never reused.
create function public.reserve_hire_employee_number(candidate_id uuid, kot_codes text[]) returns text
language plpgsql security definer set search_path = public as $$
declare chosen text; n integer;
begin
 if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(41820261024);
 select employee_number into chosen from system_hire_candidates where id = candidate_id for update;
 if not found then raise exception 'candidate missing'; end if;
 if chosen is not null then return chosen; end if;
 select coalesce(max(employee_number::numeric),0)::integer + 1 into n from root_employees
 where employee_number ~ '^[0-9]+$' and case when employee_number ~ '^[0-9]+$' then employee_number::numeric < 9000 else false end;
 while n < 9000 loop
  exit when not exists(select 1 from system_hire_candidates where employee_number::numeric = n)
   and not exists(select 1 from unnest(kot_codes) c where case when c ~ '^[0-9]+$' then c::numeric = n else false end);
  n := n + 1;
 end loop;
 if n >= 9000 then raise exception 'employee number exhausted'; end if;
 chosen := n::text;
 update system_hire_candidates set employee_number = chosen, updated_at = now() where id = candidate_id;
 return chosen;
end $$;
revoke all on function public.reserve_hire_employee_number(uuid,text[]) from public, anon, authenticated;
grant execute on function public.reserve_hire_employee_number(uuid,text[]) to service_role;
commit;
