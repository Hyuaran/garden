-- 20261021000005 の bud_mf_apply_link_alerts：WHERE の無い UPDATE を Supabase が断るため where true を付けて作り直す（2026-10-21 本番で発生）
create or replace function public.bud_mf_apply_link_alerts(p_messages jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb; latest_id text;
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_link_alerts'));
 for m in select value from jsonb_array_elements(p_messages) loop
  insert into bud_mf_link_alert_messages(message_id,received_at)
  values(m->>'message_id',(m->>'received_at')::timestamptz) on conflict do nothing;
  insert into bud_mf_link_alerts(message_id,received_at,mail_account_name,last_success_date,reason,reason_text,mf_account_id)
  select m->>'message_id',(m->>'received_at')::timestamptz,x.mail_account_name,x.last_success_date,x.reason,x.reason_text,x.mf_account_id
  from jsonb_to_recordset(m->'alerts') as x(mail_account_name text,last_success_date date,reason text,reason_text text,mf_account_id text)
  on conflict(message_id,mail_account_name) do update set mf_account_id=excluded.mf_account_id;
 end loop;
 select message_id into latest_id from bud_mf_link_alert_messages order by received_at desc,message_id desc limit 1;
 update bud_mf_link_alerts a set active = (a.message_id=latest_id and not exists (
  select 1 from bud_mf_link_alerts d where d.mail_account_name=a.mail_account_name and d.dismissed_at >= a.received_at
 )) where true; -- Supabase は WHERE の無い UPDATE を断る
end $$;
