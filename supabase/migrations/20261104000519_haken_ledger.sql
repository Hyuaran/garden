-- Codex-518: ファイルのみ作成。本番適用・初期データ投入は行わない。
begin;

create table public.system_haken_party (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 200),
 office_name text not null default '' check (length(office_name)<=200),
 address text not null default '' check (length(address)<=1000),
 permit_no text not null default '' check (length(permit_no)<=100),
 manager_name text not null default '' check (length(manager_name)<=200),
 manager_tel text not null default '' check (length(manager_tel)<=100),
 complaint_name text not null default '' check (length(complaint_name)<=200),
 complaint_tel text not null default '' check (length(complaint_tel)<=100),
 invoice_delivery text not null default 'mail' check (invoice_delivery in ('mail','portal')),
 basic_contract_on date,
 note text not null default '' check (length(note)<=5000),
 side_supplier boolean not null default true,
 side_client boolean not null default false,
 issue_defaults jsonb not null default '{}' check (jsonb_typeof(issue_defaults)='object' and octet_length(issue_defaults::text)<=30000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_party enable row level security;
revoke all on public.system_haken_party from public, anon, authenticated;
grant all on public.system_haken_party to service_role;

create table public.system_haken_office (
 id uuid primary key default gen_random_uuid(),
 company_id text not null references public.root_companies(company_id),
 name text not null check (length(name) between 1 and 200),
 address text not null default '' check (length(address)<=1000),
 training_note text not null default '' check (length(training_note)<=3000),
 cafeteria_note text not null default '' check (length(cafeteria_note)<=1000),
 rest_room_note text not null default '' check (length(rest_room_note)<=1000),
 changing_room_note text not null default '' check (length(changing_room_note)<=1000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_office enable row level security;
revoke all on public.system_haken_office from public, anon, authenticated;
grant all on public.system_haken_office to service_role;

create table public.system_haken_contract (
 id uuid primary key default gen_random_uuid(),
 side text not null default 'ukeire' check (side in ('ukeire','haken')),
 party_id uuid not null references public.system_haken_party(id),
 office_id uuid not null references public.system_haken_office(id),
 hire_candidate_id uuid unique references public.system_hire_candidates(id),
 org_unit text not null default '' check (length(org_unit)<=300),
 work_content text not null default '' check (length(work_content)<=3000),
 responsibility text not null default '' check (length(responsibility)<=1000),
 period_start date not null,
 period_end date check (period_end >= period_start),
 work_days text not null default '' check (length(work_days)<=1000),
 work_hours text not null default '' check (length(work_hours)<=1000),
 break_note text not null default '' check (length(break_note)<=1000),
 supervisor_name text not null default '' check (length(supervisor_name)<=300),
 commander_name text not null default '' check (length(commander_name)<=300),
 complaint_owner_name text not null default '' check (length(complaint_owner_name)<=300),
 is_introduction boolean not null default false,
 no_limit_reason text not null default '' check (length(no_limit_reason)<=1000),
 notified_conflict_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_contract enable row level security;
revoke all on public.system_haken_contract from public, anon, authenticated;
grant all on public.system_haken_contract to service_role;

create table public.system_haken_worker (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid not null unique references public.system_haken_contract(id),
 employee_id text references public.root_employees(employee_id),
 name text not null check (length(name) between 1 and 200),
 gender text check (gender in ('male','female')),
 is_indefinite boolean not null default false,
 is_over_60 boolean not null default false,
 is_agreement boolean not null default false,
 health_insurance boolean not null default false,
 pension boolean not null default false,
 employment_insurance boolean not null default false,
 insurance_reason text not null default '' check (length(insurance_reason)<=1000),
 party_notice_on date,
 start_on date not null,
 end_on date check (end_on>=start_on),
 end_reason text not null default '' check (length(end_reason)<=1000),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_worker enable row level security;
revoke all on public.system_haken_worker from public, anon, authenticated;
grant all on public.system_haken_worker to service_role;

create table public.system_haken_document (
 id uuid primary key default gen_random_uuid(),
 contract_id uuid references public.system_haken_contract(id),
 party_id uuid references public.system_haken_party(id),
 hire_candidate_id uuid references public.system_hire_candidates(id),
 issue_batch_id uuid,
 doc_type text not null check (doc_type in ('basic','individual','conflict_notice','treatment','reply','party_notice','other')),
 document_status text not null default 'received' check (document_status in ('issued','received')),
 issued_on date not null,
 file_name text not null check (length(file_name) between 1 and 255),
 drive_file_id text check (length(drive_file_id)<=500),
 drive_url text check (length(drive_url)<=2000),
 save_error text check (length(save_error)<=1000),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_document enable row level security;
revoke all on public.system_haken_document from public, anon, authenticated;
grant all on public.system_haken_document to service_role;

create table public.system_haken_event (
 id uuid primary key default gen_random_uuid(),
 worker_id uuid not null references public.system_haken_worker(id),
 on_date date not null,
 kind text not null check (kind in ('training','complaint')),
 content text not null check (length(content) between 1 and 5000),
 handler text not null default '' check (length(handler)<=300),
 result text not null default '' check (length(result)<=3000),
 party_contact text not null default '' check (length(party_contact)<=3000),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_event enable row level security;
revoke all on public.system_haken_event from public, anon, authenticated;
grant all on public.system_haken_event to service_role;

create table public.system_haken_notice_log (
 id uuid primary key default gen_random_uuid(),
 notice_key text not null unique check (length(notice_key) between 1 and 500),
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by text check (length(created_by)<=200),
 updated_by text check (length(updated_by)<=200)
);
alter table public.system_haken_notice_log enable row level security;
revoke all on public.system_haken_notice_log from public, anon, authenticated;
grant all on public.system_haken_notice_log to service_role;

alter table public.root_employees add column haken_party_id uuid references public.system_haken_party(id);
alter table public.system_hire_candidates
 add column haken_party_id uuid references public.system_haken_party(id),
 add column haken_period_end date,
 add column haken_issue_batch_id uuid,
 add constraint hire_haken_period check (haken_period_end is null or haken_period_end>=hire_date);
create index on public.system_haken_contract(office_id,period_start);
create index on public.system_haken_worker(employee_id);
create index on public.system_haken_document(contract_id) where deleted_at is null;

-- 保存期限は受け口に加えてデータベースでも保護する。
create function public.guard_haken_worker_retention() returns trigger
language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then
  raise exception '派遣先管理台帳は物理削除できません';
 end if;
 if new.deleted_at is not null and new.end_on is not null
    and (current_timestamp at time zone 'Asia/Tokyo')::date < (new.end_on + interval '3 years')::date then
  raise exception '派遣終了から3年間は台帳を削除できません';
 end if;
 if old.end_on is not null and (current_timestamp at time zone 'Asia/Tokyo')::date < (old.end_on + interval '3 years')::date then
  if new.deleted_at is not null or new.end_on is null then
   raise exception '保存期限前の台帳は削除できません';
  end if;
 end if;
 return new;
end $$;
create trigger guard_haken_worker_retention before update or delete on public.system_haken_worker
for each row execute function public.guard_haken_worker_retention();
revoke all on function public.guard_haken_worker_retention() from public, anon, authenticated;
grant execute on function public.guard_haken_worker_retention() to service_role;

-- 入社時の連携を同一トランザクションで行う。入社予定者ごとの一意制約で再実行にも対応。
create function public.create_haken_from_hire(p_candidate uuid, p_employee text, p_actor text)
returns uuid language plpgsql set search_path=public as $$
declare c system_hire_candidates; p system_haken_party; o uuid; d jsonb; contract_uuid uuid;
begin
 select * into strict c from system_hire_candidates where id=p_candidate for update;
 if c.employment_type <> '派遣' then return null; end if;
 if c.haken_party_id is null or c.haken_period_end is null then
  raise exception '派遣会社と終了日を入力してください';
 end if;
 select * into strict p from system_haken_party where id=c.haken_party_id;
 d:=p.issue_defaults;
 o:=nullif(d->>'office_id','')::uuid;
 if o is null or not exists(select 1 from system_haken_office where id=o and company_id=c.company_id) then
  raise exception '発行書類の初期値に受入事業所を設定してください';
 end if;
 insert into system_haken_contract(side,party_id,office_id,hire_candidate_id,org_unit,work_content,responsibility,
 period_start,period_end,work_days,work_hours,break_note,supervisor_name,commander_name,complaint_owner_name,created_by)
 values('ukeire',p.id,o,c.id,coalesce(d->>'org_unit',''),coalesce(d->>'work_content',''),coalesce(d->>'responsibility',''),
 c.hire_date,c.haken_period_end,coalesce(d->>'work_days',''),coalesce(d->>'work_hours',''),coalesce(d->>'break_note',''),
 coalesce(d->>'supervisor_name',''),coalesce(d->>'commander_name',''),coalesce(d->>'complaint_owner_name',''),p_actor)
 on conflict(hire_candidate_id) do nothing returning id into contract_uuid;
 if contract_uuid is null then
  select id into contract_uuid from system_haken_contract where hire_candidate_id=c.id;
 end if;
 insert into system_haken_worker(contract_id,employee_id,name,gender,start_on,end_on,created_by)
 values(contract_uuid,p_employee,trim(c.last_name || ' ' || coalesce(c.first_name,'')),nullif(c.gender,''),c.hire_date,c.haken_period_end,p_actor)
 on conflict(contract_id) do nothing;
 update root_employees set haken_party_id=p.id where employee_id=p_employee;
 update system_haken_document set contract_id=contract_uuid where (hire_candidate_id=c.id or issue_batch_id=c.haken_issue_batch_id) and contract_id is null;
 return contract_uuid;
end $$;
revoke all on function public.create_haken_from_hire(uuid,text,text) from public, anon, authenticated;
grant execute on function public.create_haken_from_hire(uuid,text,text) to service_role;

-- 契約と台帳の保存は全体を成功・失敗させ、片方だけを残さない。
create function public.save_haken_ledger(p_contract jsonb, p_worker jsonb, p_actor text)
returns jsonb language plpgsql set search_path=public as $$
declare c system_haken_contract; w system_haken_worker; base jsonb;
begin
 select * into c from system_haken_contract where id=nullif(p_contract->>'id','')::uuid for update;
 if c.id is not null and c.side<>'ukeire' then raise exception '受入契約を確認してください'; end if;
 base:=coalesce(to_jsonb(c),'{}'::jsonb);
 if c.id is null then base:=jsonb_build_object('id',gen_random_uuid(),'created_at',now(),'created_by',p_actor); end if;
 c:=jsonb_populate_record(null::system_haken_contract,base || p_contract || jsonb_build_object('side','ukeire','updated_at',now(),'updated_by',p_actor));
 insert into system_haken_contract select c.* on conflict(id) do update set
 party_id=excluded.party_id,
 office_id=excluded.office_id,
 org_unit=excluded.org_unit,
 work_content=excluded.work_content,
 responsibility=excluded.responsibility,
 period_start=excluded.period_start,
 period_end=excluded.period_end,
 work_days=excluded.work_days,
 work_hours=excluded.work_hours,
 break_note=excluded.break_note,
 supervisor_name=excluded.supervisor_name,
 commander_name=excluded.commander_name,
 complaint_owner_name=excluded.complaint_owner_name,
 is_introduction=excluded.is_introduction,
 no_limit_reason=excluded.no_limit_reason,
 notified_conflict_on=excluded.notified_conflict_on,
 updated_at=excluded.updated_at,
 updated_by=excluded.updated_by;
 select * into w from system_haken_worker where id=nullif(p_worker->>'id','')::uuid for update;
 if w.id is not null and w.contract_id<>c.id then raise exception '台帳を確認してください'; end if;
 base:=coalesce(to_jsonb(w),'{}'::jsonb);
 if w.id is null then base:=jsonb_build_object('id',gen_random_uuid(),'created_at',now(),'created_by',p_actor); end if;
 w:=jsonb_populate_record(null::system_haken_worker,base || p_worker || jsonb_build_object('contract_id',c.id,'updated_at',now(),'updated_by',p_actor));
 insert into system_haken_worker select w.* on conflict(id) do update set
 employee_id=excluded.employee_id,
 name=excluded.name,
 gender=excluded.gender,
 is_indefinite=excluded.is_indefinite,
 is_over_60=excluded.is_over_60,
 is_agreement=excluded.is_agreement,
 health_insurance=excluded.health_insurance,
 pension=excluded.pension,
 employment_insurance=excluded.employment_insurance,
 insurance_reason=excluded.insurance_reason,
 party_notice_on=excluded.party_notice_on,
 start_on=excluded.start_on,
 end_on=excluded.end_on,
 end_reason=excluded.end_reason,
 updated_at=excluded.updated_at,
 updated_by=excluded.updated_by;
 return to_jsonb(w);
end $$;
revoke all on function public.save_haken_ledger(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.save_haken_ledger(jsonb,jsonb,text) to service_role;

commit;
