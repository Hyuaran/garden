-- One shared, atomic sliding window across server instances. No cron required.
create table public.liff_submission_limits (
 employee_id text primary key references public.root_employees(employee_id) on delete cascade,
 attempts timestamptz[] not null default '{}'
);
alter table public.liff_submission_limits enable row level security;
revoke all on public.liff_submission_limits from anon, authenticated;
create or replace function public.consume_liff_submission_limit(p_employee_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare recent timestamptz[]; now_at timestamptz;
begin
 insert into public.liff_submission_limits(employee_id) values(p_employee_id) on conflict do nothing;
 select attempts into recent from public.liff_submission_limits where employee_id=p_employee_id for update;
 now_at := clock_timestamp();
 select coalesce(array_agg(t), '{}') into recent from unnest(recent) t where t > now_at - interval '1 minute';
 if cardinality(recent) >= 5 then return false; end if;
 update public.liff_submission_limits set attempts=array_append(recent,now_at) where employee_id=p_employee_id;
 return true;
end;
$$;
revoke all on function public.consume_liff_submission_limit(text) from public, anon, authenticated;
grant execute on function public.consume_liff_submission_limit(text) to service_role;
