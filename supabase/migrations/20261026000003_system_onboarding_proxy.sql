-- 作成のみ。本番には適用しない。
begin;

-- 他人の機微情報をPostgRESTから直接読む・書く経路を閉じる。
-- 本人用のownポリシーは維持。事務操作はサーバーで認可後、管理者接続で実行する。
drop policy if exists system_onboarding_manager_select on public.system_onboarding;
drop policy if exists system_onboarding_manager_insert on public.system_onboarding;
drop policy if exists system_onboarding_manager_update on public.system_onboarding;
create table if not exists public.system_onboarding_proxy_log (
  id bigint generated always as identity primary key,
  employee_id text not null,
  actor_employee_id text not null,
  actor_name text not null,
  step integer not null check (step between 0 and 10),
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.system_onboarding_proxy_log enable row level security;
revoke all on public.system_onboarding_proxy_log from anon, authenticated;
grant all on public.system_onboarding_proxy_log to service_role;
grant usage, select on sequence public.system_onboarding_proxy_log_id_seq to service_role;

-- 保存と監査は同じトランザクション。行ロック後に提出済みを再判定する。
create or replace function public.save_onboarding_proxy(
  p_employee_id text, p_actor text, p_actor_name text, p_step integer,
  p_submit boolean, p_sensitive boolean, p_values jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare
  previous public.system_onboarding%rowtype;
  updated public.system_onboarding%rowtype;
  fields jsonb;
  family jsonb;
  item jsonb;
  old_item jsonb;
  idx integer;
begin
  insert into public.system_onboarding(employee_id) values (p_employee_id) on conflict (employee_id) do nothing;
  select * into previous from public.system_onboarding where employee_id = p_employee_id for update;
  if previous.status = 'submitted' then raise exception 'already submitted'; end if;
  fields := p_values - 'nda_agreed';
  if not p_sensitive then
    fields := fields - array['bank_name','bank_code','branch_name','branch_code','account_type','account_number','account_holder_kana','my_number'];
  elsif coalesce(fields->>'my_number', '') ~ '^••••••••[0-9]{4}$' then
    fields := fields - 'my_number';
  end if;
  family := '[]'::jsonb;
  for item, idx in select value, (ordinality - 1)::integer from jsonb_array_elements(coalesce(fields->'dependents','[]'::jsonb)) with ordinality loop
    old_item := coalesce(previous.dependents::jsonb->idx, '{}'::jsonb);
    if not p_sensitive or coalesce(item->>'my_number', '') ~ '^••••••••[0-9]{4}$' then
      item := (item - 'my_number') || jsonb_build_object('my_number', coalesce(old_item->>'my_number',''));
    end if;
    family := family || jsonb_build_array(item);
  end loop;
  fields := fields || jsonb_build_object('dependents',family);
  updated := jsonb_populate_record(previous, fields);
  update public.system_onboarding set
    name = updated.name, name_kana = updated.name_kana, gender = updated.gender, birth_date = updated.birth_date,
    postal_code = updated.postal_code, address = updated.address, address_kana = updated.address_kana,
    phone = updated.phone, email = updated.email, householder_name = updated.householder_name, householder_relation = updated.householder_relation,
    pension_number = updated.pension_number, employment_insurance_status = updated.employment_insurance_status,
    employment_insurance_number = updated.employment_insurance_number, previous_employer = updated.previous_employer,
    previous_employer_from = updated.previous_employer_from, previous_employer_to = updated.previous_employer_to,
    commute_method = updated.commute_method, commute_routes = updated.commute_routes,
    bank_name = updated.bank_name, bank_code = updated.bank_code, branch_name = updated.branch_name, branch_code = updated.branch_code,
    account_type = updated.account_type, account_number = updated.account_number, account_holder_kana = updated.account_holder_kana,
    my_number = updated.my_number, dependents = updated.dependents,
    emergency_name = updated.emergency_name, emergency_relation = updated.emergency_relation,
    emergency_relation_other = updated.emergency_relation_other, emergency_address = updated.emergency_address, emergency_phone = updated.emergency_phone,
    nda_agreed_at = case when p_values->>'nda_agreed' = 'true' then coalesce(previous.nda_agreed_at, now()) else null end,
    status = case when p_submit then 'submitted' else 'draft' end,
    submitted_at = case when p_submit then now() else null end
  where employee_id = p_employee_id;
  insert into public.system_onboarding_proxy_log(employee_id,actor_employee_id,actor_name,step,action)
  values (p_employee_id,p_actor,p_actor_name,p_step,case when p_submit then '代行で提出（入力：' || p_actor_name || '）' else '代行で保存' end);
end;
$$;
revoke all on function public.save_onboarding_proxy(text,text,text,integer,boolean,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.save_onboarding_proxy(text,text,text,integer,boolean,boolean,jsonb) to service_role;
commit;
