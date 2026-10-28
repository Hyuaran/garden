-- Prepared only; do not apply to production from Codex.
begin;
alter table public.root_mail_forwardings add column guide_path text;
alter table public.root_mail_forwarding_notices drop constraint root_mail_forwarding_notices_stage_check;
alter table public.root_mail_forwarding_notices add constraint root_mail_forwarding_notices_stage_check check(stage in ('60','30','14','7','expired','unfiled'));
create or replace function public.root_mail_forwarding_create(p_row jsonb,p_filing jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare result uuid;
begin
 insert into root_mail_forwardings(id,holder,from_address,to_address,notes)
 values((p_row->>'id')::uuid,p_row->>'holder',p_row->>'from_address',p_row->>'to_address',coalesce(p_row->>'notes','')) returning id into result;
 if p_filing is not null and p_filing <> 'null'::jsonb then
 insert into root_mail_forwarding_filings(id,forwarding_id,filed_on,method,receipt,filed_by,notes)
 values((p_filing->>'id')::uuid,result,(p_filing->>'filed_on')::date,coalesce(p_filing->>'method','e転居'),coalesce(p_filing->>'receipt',''),coalesce(p_filing->>'filed_by',''),coalesce(p_filing->>'notes',''));
 end if;
 return result;
end $$;

insert into storage.buckets(id,name,public) values('root-mail-forwarding','root-mail-forwarding',false)
on conflict(id) do update set public=false;
create policy root_mail_forwarding_private on storage.objects as restrictive for all to anon,authenticated
using(bucket_id <> 'root-mail-forwarding') with check(bucket_id <> 'root-mail-forwarding');
commit;
