-- Local/test database only, after migration; requires two active employee fixtures.
-- Always rolled back. Do not run against production.
begin;
do $$
declare a public.root_employees%rowtype; b public.root_employees%rowtype; result jsonb; expiry timestamptz;
begin
  select * into a from public.root_employees where is_active and deleted_at is null order by employee_id limit 1;
  select * into b from public.root_employees where is_active and deleted_at is null and employee_id <> a.employee_id order by employee_id limit 1;
  if a.employee_id is null or b.employee_id is null then raise exception 'two active employee fixtures required'; end if;
  delete from public.system_line_link_codes where employee_id in (a.employee_id, b.employee_id);
  update public.root_employees set line_user_id = null where employee_id in (a.employee_id, b.employee_id);
  result := public.system_issue_line_link_code(a.employee_id, '4K7P');
  assert result->>'code' = '4K7P', 'issued code';
  select expires_at into expiry from public.system_line_link_codes where employee_id = a.employee_id;
  assert expiry = now() + interval '24 hours', '24 hour expiry';
  result := public.system_issue_line_link_code(a.employee_id, 'ABCD');
  assert result->>'code' = '4K7P', 'reuse valid code';
  result := public.system_consume_line_link_code(b.employee_number, '4K7P', 'test-codex419-line', 'test');
  assert result->>'linked' = 'false', 'another employee cannot use code';
  update public.system_line_link_codes set expires_at = now() where employee_id = a.employee_id;
  result := public.system_consume_line_link_code(a.employee_number, '4K7P', 'test-codex419-line', 'test');
  assert result->>'linked' = 'false', 'expired code rejected';
  result := public.system_issue_line_link_code(a.employee_id, 'ABCD');
  assert result->>'code' = 'ABCD', 'expired code replaced';
  update public.root_employees set line_user_id = 'test-codex419-old' where employee_id = a.employee_id;
  update public.root_employees set line_user_id = 'test-codex419-line' where employee_id = b.employee_id;
  result := public.system_consume_line_link_code(a.employee_number, 'ABCD', 'test-codex419-line', 'test');
  assert result->>'linked' = 'true', 'valid code accepted';
  assert (select line_user_id = 'test-codex419-line' from public.root_employees where employee_id = a.employee_id), 'existing LINE replaced';
  assert (select line_user_id is null from public.root_employees where employee_id = b.employee_id), 'previous employee cleared';
  assert (select used_at is not null from public.system_line_link_codes where employee_id = a.employee_id and code = 'ABCD'), 'consumed timestamp';
  result := public.system_consume_line_link_code(a.employee_number, 'ABCD', 'test-codex419-other', 'test');
  assert result->>'linked' = 'false', 'consumed code rejected';
end $$;
rollback;
