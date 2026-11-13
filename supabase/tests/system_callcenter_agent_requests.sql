-- LOCAL/TEST DATABASE ONLY after migration; all changes roll back.
begin;
delete from public.system_call_sync_requests;
delete from public.system_callcenter_agent_auth;
insert into public.system_callcenter_agent_auth(id, secret_hash)
values ('host-pc', encode(extensions.digest('test-secret', 'sha256'), 'hex'));
do $$
declare result jsonb; job uuid;
begin
  begin
    perform public.system_callcenter_agent_take_request('wrong', 'test');
    raise exception 'wrong secret accepted';
  exception when others then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  assert (select last_seen_at is null from public.system_callcenter_agent_auth where id='host-pc');
  assert public.system_callcenter_agent_take_request('test-secret', 'test') is null;
  insert into public.system_call_sync_requests(requested_by, requested_at) values ('test', now() - interval '1 minute') returning id into job;
  result := public.system_callcenter_agent_take_request('test-secret', 'test');
  assert result->>'id' = job::text;
  assert (select status='running' and started_at is not null from public.system_call_sync_requests where id=job);
  assert public.system_callcenter_agent_take_request('test-secret', 'test') is null;
  begin
    perform public.system_callcenter_agent_finish_request('wrong', job, true, null);
    raise exception 'wrong secret accepted';
  exception when others then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  assert public.system_callcenter_agent_finish_request('test-secret', job, true, null);
  assert (select status='done' and finished_at is not null and error is null from public.system_call_sync_requests where id=job);
  assert not public.system_callcenter_agent_finish_request('test-secret', job, false, 'late');
  insert into public.system_call_sync_requests(requested_by,status,started_at) values ('test','running',now()-interval '11 minutes') returning id into job;
  perform public.system_callcenter_agent_take_request('test-secret', 'test');
  assert (select status='failed' and error='stale' and finished_at is not null from public.system_call_sync_requests where id=job);
  assert (select last_seen_at is not null and agent_version='test' from public.system_callcenter_agent_auth where id='host-pc');
end $$;
rollback;
