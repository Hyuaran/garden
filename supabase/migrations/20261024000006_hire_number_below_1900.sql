begin;
-- 社員番号は「1900 未満のいちばん大きい番号＋1」から（1900〜1902 は 2025-08 の付け間違い＝飛び番・2026-10-24 東海林さん）。
-- 進めた先で、Garden・KOT・他の入社予定者のどれかで使われている番号は飛ばす。
create or replace function public.reserve_hire_employee_number(candidate_id uuid, kot_codes text[]) returns text
language plpgsql security definer set search_path = public as $$
declare chosen text; n integer;
begin
 if auth.role() <> 'service_role' then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(41820261024);
 select employee_number into chosen from system_hire_candidates where id = candidate_id for update;
 if not found then raise exception 'candidate missing'; end if;
 if chosen is not null then return chosen; end if;
 select coalesce(max(employee_number::numeric),0)::integer + 1 into n from root_employees
 where employee_number ~ '^[0-9]+$' and case when employee_number ~ '^[0-9]+$' then employee_number::numeric < 1900 else false end;
 while n < 9000 loop
  exit when not exists(select 1 from system_hire_candidates where employee_number ~ '^[0-9]+$' and employee_number::numeric = n)
   and not exists(select 1 from root_employees where employee_number ~ '^[0-9]+$' and employee_number::numeric = n)
   and not exists(select 1 from unnest(kot_codes) c where case when c ~ '^[0-9]+$' then c::numeric = n else false end);
  n := n + 1;
 end loop;
 if n >= 9000 then raise exception 'employee number exhausted'; end if;
 chosen := lpad(n::text, 4, '0');
 update system_hire_candidates set employee_number = chosen, updated_at = now() where id = candidate_id;
 return chosen;
end $$;
revoke all on function public.reserve_hire_employee_number(uuid,text[]) from public, anon, authenticated;
grant execute on function public.reserve_hire_employee_number(uuid,text[]) to service_role;
commit;
