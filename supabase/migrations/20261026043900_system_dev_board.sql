-- Apply manually. No production connection is used by this dispatch.
create table public.system_dev_questions (
 id uuid primary key default gen_random_uuid(),
 module text not null check (module in ('system','bloom','fruit','seed','forest','bud','leaf','tree','sprout','soil','root','rill','calendar','common')),
 title text not null, body text not null default '',
 answer_type text not null check (answer_type in ('choice','text')),
 options jsonb not null default '[]',
 status text not null default 'open' check (status in ('open','answered','in_progress','done')),
 answer_choice text, answer_text_raw text, answer_text text, answered_at timestamptz, answered_by text,
 created_by text not null default 'claude', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), done_at timestamptz, sort integer not null default 0
);
create table public.system_dev_question_logs (
 id uuid primary key default gen_random_uuid(), question_id uuid not null references public.system_dev_questions(id) on delete cascade,
 at timestamptz not null default now(), actor text not null, action text not null, detail jsonb not null default '{}'
);
create index on public.system_dev_question_logs(question_id, at);
create function public.system_dev_is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from root_employees where user_id=auth.uid() and employee_id='EMP-0008' and is_active=true and deleted_at is null and (termination_date is null or termination_date > (now() at time zone 'Asia/Tokyo')::date));
$$;
revoke all on function public.system_dev_is_owner() from public;
grant execute on function public.system_dev_is_owner() to authenticated;
alter table public.system_dev_questions enable row level security;
alter table public.system_dev_question_logs enable row level security;
revoke all on public.system_dev_questions, public.system_dev_question_logs from anon, authenticated;
grant select, insert on public.system_dev_questions to authenticated;
grant update(answer_choice,answer_text_raw,answer_text,answered_at,answered_by) on public.system_dev_questions to authenticated;
grant select on public.system_dev_question_logs to authenticated;
grant all on public.system_dev_questions, public.system_dev_question_logs to service_role;
create policy dev_question_read on public.system_dev_questions for select to authenticated using(public.system_dev_is_owner());
create policy dev_question_insert on public.system_dev_questions for insert to authenticated with check(public.system_dev_is_owner() and created_by='EMP-0008' and status='open');
create policy dev_question_answer on public.system_dev_questions for update to authenticated using(public.system_dev_is_owner()) with check(public.system_dev_is_owner() and answered_by='EMP-0008');
create policy dev_log_read on public.system_dev_question_logs for select to authenticated using(public.system_dev_is_owner());
-- The trigger also captures direct administrator writes by Claude, including previous answers.
create function public.system_dev_audit() returns trigger language plpgsql security definer set search_path=public as $$
declare actor_id text;
begin
 actor_id := coalesce(nullif(current_setting('garden.dev_actor',true),''),case when auth.uid() is not null then 'EMP-0008' else 'claude' end);
 if TG_OP='UPDATE' then
  new.updated_at:=now();
  if (new.answer_text,new.answer_text_raw,new.answered_at) is distinct from (old.answer_text,old.answer_text_raw,old.answered_at) then new.status:='answered'; new.done_at:=null; end if;
  if new.status='done' and old.status<>'done' then new.done_at:=now(); end if;
  insert into system_dev_question_logs(question_id,actor,action,detail) values(new.id,actor_id,case when new.status='answered' then 'answered' else 'updated' end,jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new)));
 else
  insert into system_dev_question_logs(question_id,actor,action,detail) values(new.id,new.created_by,'created',to_jsonb(new));
 end if;
 return new;
end $$;
-- INSERT must run after its parent row exists; UPDATE runs before to maintain timestamps.
create trigger dev_question_created after insert on public.system_dev_questions for each row execute function public.system_dev_audit();
create trigger dev_question_updated before update on public.system_dev_questions for each row execute function public.system_dev_audit();
create function public.system_dev_create_question(p_module text,p_title text,p_body text,p_answer_type text,p_options jsonb,p_actor text) returns uuid language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 perform set_config('garden.dev_actor',p_actor,true);
 insert into system_dev_questions(module,title,body,answer_type,options,created_by) values(p_module,p_title,p_body,p_answer_type,p_options,p_actor) returning id into result;
 return result;
end $$;
create function public.system_dev_answer_question(p_id uuid,p_choice text,p_raw text,p_text text,p_actor text) returns void language plpgsql security invoker set search_path=public as $$
begin
 perform set_config('garden.dev_actor',p_actor,true);
 update system_dev_questions set answer_choice=p_choice,answer_text_raw=p_raw,answer_text=p_text,answered_at=clock_timestamp(),answered_by=p_actor where id=p_id;
 if not found then raise exception 'Question not found'; end if;
end $$;
revoke all on function public.system_dev_create_question(text,text,text,text,jsonb,text), public.system_dev_answer_question(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.system_dev_create_question(text,text,text,text,jsonb,text), public.system_dev_answer_question(uuid,text,text,text,text) to service_role;
