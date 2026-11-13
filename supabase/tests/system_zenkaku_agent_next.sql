-- LOCAL/TEST DATABASE ONLY after migration. Claims are mocked; all changes roll back.
begin;
create or replace function public.system_zenkaku_submit_claim_next()
returns table(id uuid, sales_id text) language sql as $$
  select '00000000-0000-0000-0000-000000000001'::uuid, 'submit-test'::text
  where current_setting('test.zenkaku_submit', true) = 'yes';
$$;
create or replace function public.system_zenkaku_claim_next()
returns table(id uuid, sales_id text) language sql as $$
  select '00000000-0000-0000-0000-000000000002'::uuid, 'check-test'::text
  where current_setting('test.zenkaku_check', true) = 'yes';
$$;
delete from public.system_zenkaku_agent_auth;
insert into public.system_zenkaku_agent_auth(id, secret_hash)
values ('host-pc', encode(extensions.digest('test-secret', 'sha256'), 'hex'));
do $$
declare result jsonb;
begin
  begin
    perform public.system_zenkaku_agent_next('wrong', 'test');
    raise exception 'wrong secret accepted';
  exception when others then
    if sqlerrm <> 'unauthorized' then raise; end if;
  end;
  assert (select last_seen_at is null from public.system_zenkaku_agent_auth where id='host-pc');
  perform set_config('test.zenkaku_submit', 'yes', true);
  perform set_config('test.zenkaku_check', 'yes', true);
  result := public.system_zenkaku_agent_next('test-secret', 'test');
  assert result->>'operation' = 'submit';
  assert result->>'salesId' = 'submit-test';
  perform set_config('test.zenkaku_submit', 'no', true);
  result := public.system_zenkaku_agent_next('test-secret', 'test');
  assert result->>'operation' = 'check';
  perform set_config('test.zenkaku_check', 'no', true);
  assert public.system_zenkaku_agent_next('test-secret', 'test') is null;
  assert (select last_seen_at is not null and agent_version='test' from public.system_zenkaku_agent_auth where id='host-pc');
end $$;
rollback;
