-- 作成のみ。Claude が鍵の設定後に適用し、移し替えスクリプトを実行する。
begin;
alter table public.root_employee_my_numbers alter column my_number drop not null;
alter table public.root_employee_my_numbers
 add column if not exists my_number_cipher text,
 add column if not exists my_number_iv text,
 add column if not exists my_number_tag text,
 add column if not exists my_number_last4 text check (my_number_last4 ~ '^[0-9]{4}$'),
 add column if not exists key_version integer,
 add column if not exists source text not null default 'roster' check (source in ('roster','liff')),
 add column if not exists status text not null default 'pending' check (status in ('pending','confirmed','rejected')),
 add column if not exists photo_path text,
 add column if not exists consented_at timestamptz,
 add column if not exists confirmed_at timestamptz,
 add column if not exists confirmed_by text,
 add column if not exists rejection_reason text;
-- 既存平文はスクリプトが移す。新しい平文の書き込みは即時禁止。
create or replace function public.reject_plain_my_number() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP = 'UPDATE' and old.source = 'liff' and new.source = 'roster' then return null; end if;
 if new.my_number is not null then raise exception 'plaintext my number is prohibited'; end if;
 if new.my_number_cipher is null or new.my_number_iv is null or new.my_number_tag is null or new.my_number_last4 is null or new.key_version is distinct from 1 then raise exception 'encrypted my number is required'; end if;
 return new;
end; $$;
create trigger reject_plain_my_number before insert or update on public.root_employee_my_numbers for each row execute function public.reject_plain_my_number();
create table public.my_number_viewers(employee_id text primary key references public.root_employees(employee_id));
insert into public.my_number_viewers(employee_id) values('EMP-0008');
create table public.my_number_access_logs(
 id bigint generated always as identity primary key,
 actor_employee_id text not null, employee_id text not null,
 action text not null check(action in ('display','confirm','reject')),
 detail text, created_at timestamptz not null default now()
);
alter table public.my_number_viewers enable row level security;
alter table public.my_number_access_logs enable row level security;
revoke all on public.my_number_viewers,public.my_number_access_logs from public,anon,authenticated;
grant select on public.my_number_viewers to service_role;
grant select,insert on public.my_number_access_logs to service_role;
grant usage,select on sequence public.my_number_access_logs_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('my-number-photos','my-number-photos',false,5242880,array['image/jpeg','image/png'])
 on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;
create policy my_number_photos_private on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id <> 'my-number-photos') with check(bucket_id <> 'my-number-photos');

create or replace function public.review_my_number(p_actor text,p_employee_id text,p_submitted_at timestamptz,p_action text,p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
begin
 if not exists(select 1 from public.my_number_viewers where employee_id=p_actor) then raise exception 'not found'; end if;
 if p_action not in ('confirm','reject') or (p_action='reject' and (coalesce(trim(p_reason),'')='' or length(p_reason)>1000)) then raise exception 'invalid action'; end if;
 perform 1 from public.root_employee_my_numbers where employee_id=p_employee_id and submitted_at=p_submitted_at and my_number_cipher is not null for update;
 if not found then raise exception 'submission changed'; end if;
 update public.root_employee_my_numbers set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,
 confirmed_at=case when p_action='confirm' then now() else null end,
 confirmed_by=case when p_action='confirm' then p_actor else null end,
 rejection_reason=case when p_action='reject' then p_reason else null end where employee_id=p_employee_id;
 insert into public.my_number_access_logs(actor_employee_id,employee_id,action,detail) values(p_actor,p_employee_id,p_action,p_reason);
end; $$;
revoke all on function public.review_my_number(text,text,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.review_my_number(text,text,timestamptz,text,text) to service_role;

-- 入社手続きの本人・扶養家族の番号もアプリで暗号化する。
alter table public.system_onboarding add column if not exists my_number_secret jsonb;
create or replace function public.system_onboarding_dependents_valid(value jsonb)
returns boolean language sql immutable set search_path=pg_catalog as $$
 select case when jsonb_typeof(value)<>'array' then false else
 jsonb_array_length(value)<=30 and not exists(
  select 1 from jsonb_array_elements(value) item where
  case when jsonb_typeof(item)<>'object' then true else exists(
   select 1 from jsonb_each(item) entry where
   entry.key not in ('name','name_kana','relation','birth_date','annual_income','occupation','my_number','my_number_secret')
   or (entry.key='my_number_secret' and jsonb_typeof(entry.value) not in ('object','null'))
   or (entry.key<>'my_number_secret' and jsonb_typeof(entry.value)<>'string')
  ) end
 ) end;
$$;
create or replace function public.reject_plain_onboarding_number() returns trigger language plpgsql set search_path=public as $$
declare item jsonb;
begin
 if coalesce(new.my_number,'') <> '' and new.my_number !~ '^••••••••[0-9]{4}$' then raise exception 'plaintext my number is prohibited'; end if;
 for item in select value from jsonb_array_elements(coalesce(new.dependents::jsonb,'[]'::jsonb)) loop
  if coalesce(item->>'my_number','') <> '' and item->>'my_number' !~ '^••••••••[0-9]{4}$' then raise exception 'plaintext dependent my number is prohibited'; end if;
 end loop;
 return new;
end; $$;
create trigger reject_plain_onboarding_number before insert or update on public.system_onboarding for each row execute function public.reject_plain_onboarding_number();
-- Bud の旧 pgcrypto 経路はアプリから使われていない。役職だけの復号経路を閉じる。
do $$ begin
 if to_regprocedure('public.bud_encrypt_my_number(uuid,text,text,text)') is not null then
  execute 'revoke all on function public.bud_encrypt_my_number(uuid,text,text,text) from public,anon,authenticated,service_role';
 end if;
 if to_regprocedure('public.bud_decrypt_my_number(uuid,text,text)') is not null then
  execute 'revoke all on function public.bud_decrypt_my_number(uuid,text,text) from public,anon,authenticated,service_role';
 end if;
end $$;
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
    fields := fields - array['bank_name','bank_code','branch_name','branch_code','account_type','account_number','account_holder_kana','my_number','my_number_secret'];
  elsif coalesce(fields->>'my_number', '') ~ '^••••••••[0-9]{4}$' and not (fields ? 'my_number_secret') then
    fields := fields - 'my_number';
  end if;
  family := '[]'::jsonb;
  for item, idx in select value, (ordinality - 1)::integer from jsonb_array_elements(coalesce(fields->'dependents','[]'::jsonb)) with ordinality loop
    old_item := coalesce(previous.dependents::jsonb->idx, '{}'::jsonb);
    if not p_sensitive or (coalesce(item->>'my_number', '') ~ '^••••••••[0-9]{4}$' and not (item ? 'my_number_secret')) then
      item := (item - 'my_number') || jsonb_build_object('my_number', coalesce(old_item->>'my_number',''), 'my_number_secret',old_item->'my_number_secret');
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
    my_number = updated.my_number, my_number_secret = updated.my_number_secret, dependents = updated.dependents,
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
create or replace function public.system_onboarding_before_write()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare
  applicant_old jsonb;
  applicant_new jsonb;
begin
  if TG_OP = 'UPDATE' then
    -- service_role の移し替えのみ。番号以外の入力・提出日時は変更させない。
    if auth.role() = 'service_role'
      and (to_jsonb(NEW) - array['my_number','my_number_secret','dependents','updated_at']) = (to_jsonb(OLD) - array['my_number','my_number_secret','dependents','updated_at'])
      and (select coalesce(jsonb_agg(item - array['my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(NEW.dependents) with ordinality t(item,ord)) = (select coalesce(jsonb_agg(item - array['my_number','my_number_secret'] order by ord),'[]'::jsonb) from jsonb_array_elements(OLD.dependents) with ordinality t(item,ord))
    then
      NEW.updated_at := now();
      return NEW;
    end if;
    if NEW.id <> OLD.id or NEW.employee_id <> OLD.employee_id then
      raise exception 'identity is immutable' using errcode = '42501';
    end if;

    if OLD.status = 'submitted' then
      applicant_old := to_jsonb(OLD) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation';
      applicant_new := to_jsonb(NEW) - 'office' - 'weekly_hours' - 'health_insurance' - 'pension_insurance'
        - 'employment_insurance' - 'tax_class' - 'salary_kind' - 'base_salary' - 'allowances'
        - 'commute_fixed_monthly' - 'commute_cap_monthly' - 'admin_updated_at' - 'updated_at' - 'email'
        - 'householder_name' - 'householder_relation';
      if applicant_new <> applicant_old then
        raise exception 'submitted applicant fields are read only' using errcode = '42501';
      end if;
      NEW.created_at := OLD.created_at;
      NEW.updated_at := now();
      NEW.nda_agreed_at := OLD.nda_agreed_at;
      NEW.submitted_at := OLD.submitted_at;
      return NEW;
    end if;

    NEW.created_at := OLD.created_at;
    if NEW.nda_agreed_at is not null then NEW.nda_agreed_at := coalesce(OLD.nda_agreed_at, now()); end if;
  else
    NEW.created_at := now();
    if NEW.nda_agreed_at is not null then NEW.nda_agreed_at := now(); end if;
  end if;
  NEW.updated_at := now();
  NEW.submitted_at := case when NEW.status = 'submitted' then now() else null end;
  return NEW;
end;
$$;


commit;

