begin;

create table public.system_onboarding_admin_templates (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 100),
 sort_order integer not null default 0,
 "values" jsonb not null default '{}'::jsonb check (jsonb_typeof("values") = 'object'),
 updated_at timestamptz not null default now()
);
alter table public.system_onboarding_admin_templates enable row level security;
revoke all on public.system_onboarding_admin_templates from anon, authenticated;
grant all on public.system_onboarding_admin_templates to service_role;
insert into public.system_onboarding_admin_templates(name,sort_order,"values") values
 ('テレマバイト',1,'{}'), ('テレマ社員',2,'{}'),
 ('NHK社員',3,'{"office":"大阪本社","weekly_hours":"40","health_insurance":"加入","pension_insurance":"加入","employment_insurance":"加入","tax_class":"甲","salary_kind":"月給","base_salary":"260000","allowances":[],"commute_cap_monthly":"15000"}');

-- 行ロック中に再確認し、削除と監査記録を同じトランザクションで行う。
create function public.delete_unstarted_hire_candidate(candidate_id uuid, actor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.system_hire_candidates; drafts jsonb;
begin
 if not exists(select 1 from root_employees where user_id=actor and garden_role='super_admin' and is_active=true and deleted_at is null) then
  raise exception '全権管理者だけが削除できます' using errcode='42501';
 end if;
 select * into c from system_hire_candidates where id=candidate_id for update;
 if not found or c.status not in ('planned','no_show') or c.employee_number is not null
    or c.employee_id is not null or c.kintone_roster_record_id is not null
    or c.processing_token is not null or c.steps <> '{}'::jsonb then
  raise exception '入社処理が始まっているため削除できません' using errcode='P0001';
 end if;
 if exists(select 1 from system_hire_candidates where id<>c.id and haken_issue_batch_id=c.haken_issue_batch_id)
    or exists(select 1 from system_haken_document where issue_batch_id=c.haken_issue_batch_id and hire_candidate_id is not null and hire_candidate_id<>c.id)
    or exists(select 1 from system_haken_contract where hire_candidate_id=c.id)
    or exists(select 1 from system_haken_document where (hire_candidate_id=c.id or issue_batch_id=c.haken_issue_batch_id) and contract_id is not null)
    or exists(select 1 from system_filemaker_account_requests where hire_candidate_id=c.id and (employee_id is not null or status <> 'waiting')) then
  raise exception '関連する手続きがあるため削除できません' using errcode='P0001';
 end if;
 -- この予定専用の書類の控えだけ。保管庫の実ファイルや外部データには触れない。
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'drive_file_id',drive_file_id)), '[]'::jsonb)
 into drafts from system_haken_document where (hire_candidate_id=c.id or issue_batch_id=c.haken_issue_batch_id) and contract_id is null;
 delete from system_haken_document where (hire_candidate_id=c.id or issue_batch_id=c.haken_issue_batch_id) and contract_id is null;
 insert into root_audit_log(actor_user_id,action,target_type,target_id,payload)
 values(actor,'master_update','system_hire_candidates',c.id::text,jsonb_build_object('operation','delete','previous_status',c.status,'draft_documents',drafts));
 -- FileMaker の未送信下書きと LINE 確認の控えは既存の ON DELETE CASCADE。
 delete from system_hire_candidates where id=c.id;
end $$;
revoke all on function public.delete_unstarted_hire_candidate(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_unstarted_hire_candidate(uuid,uuid) to service_role;
commit;
