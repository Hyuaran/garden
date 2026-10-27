begin;
alter table public.system_hire_candidates
 add column line_verified boolean not null default false,
 add column line_verified_at timestamptz,
 add column line_verified_by uuid;
create table public.system_hire_line_checks (
 hire_candidate_id uuid primary key references public.system_hire_candidates(id) on delete cascade,
 salt text not null,
 code_hash text not null,
 expires_at timestamptz not null,
 attempts integer not null default 0 check (attempts between 0 and 5)
);
alter table public.system_hire_line_checks enable row level security;
revoke all on public.system_hire_line_checks from anon, authenticated;
grant all on public.system_hire_line_checks to service_role;
create function public.verify_hire_line_code(candidate_id uuid,digest text,actor uuid)
returns text language plpgsql security definer set search_path=public as $$
declare c system_hire_candidates; r system_hire_line_checks; remaining integer;
begin
 select * into c from system_hire_candidates where id=candidate_id for update;
 if c.status is distinct from 'hired' or not (
  coalesce(c.checklist->'contract_signed'->>'checked_at','') <> '' and coalesce(c.checklist->'contract_signed'->>'checked_by','') <> '' and
  coalesce(c.checklist->'nda_signed'->>'checked_at','') <> '' and coalesce(c.checklist->'nda_signed'->>'checked_by','') <> '' and
  coalesce(c.checklist->'emergency_signed'->>'checked_at','') <> '' and coalesce(c.checklist->'emergency_signed'->>'checked_by','') <> ''
 ) then
  return '①の締結がそろうと進めます';
 end if;
 select * into r from system_hire_line_checks where hire_candidate_id=candidate_id for update;
 if not found or r.expires_at<=now() then return '期限が切れました。もう一度送ってください'; end if;
 if r.attempts>=5 then return '確認回数を超えました。もう一度送ってください'; end if;
 if r.code_hash<>digest then
  remaining:=4-r.attempts;
  update system_hire_line_checks set attempts=attempts+1 where hire_candidate_id=candidate_id;
  return 'コードが違います（あと '||remaining||' 回）'||case when remaining=0 then '。もう一度送ってください' else '' end;
 end if;
 update system_hire_candidates set line_verified=true,line_verified_at=now(),line_verified_by=actor,updated_at=now() where id=candidate_id;
 delete from system_hire_line_checks where hire_candidate_id=candidate_id;
 return 'ok';
end;
$$;
revoke all on function public.verify_hire_line_code(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.verify_hire_line_code(uuid,text,uuid) to service_role;
commit;
