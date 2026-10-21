begin;
alter table public.bud_bb_records
 add column recon_status text check (recon_status in ('matched','amount_mismatch','not_arrived','ambiguous','pending','excluded')),
 add column expected_gross bigint,
 add column recon_fee integer,
 add column recon_checked_at timestamptz,
 add column recon_bank jsonb default '[]';
alter table public.bud_bb_settings add column last_started_at timestamptz;
create or replace function public.bud_bb_claim(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update bud_bb_settings set run_token=p_token,run_until=now()+interval '10 minutes',last_started_at=now()
 where id and (run_until is null or run_until < now()) and (last_started_at is null or last_started_at < now()-interval '1 minute');
 return found;
end $$;
create function public.bud_bb_save_recon(p_rows jsonb) returns void language sql security definer set search_path=public as $$
 update bud_bb_records r set recon_status=v.recon_status, expected_gross=v.expected_gross,
 recon_fee=v.recon_fee,recon_checked_at=v.recon_checked_at,recon_bank=v.recon_bank
 from jsonb_to_recordset(p_rows) as v(kintone_record_id text,recon_status text,expected_gross bigint,recon_fee integer,recon_checked_at timestamptz,recon_bank jsonb)
 where r.kintone_record_id=v.kintone_record_id;
$$;
revoke all on function public.bud_bb_save_recon(jsonb) from public,anon,authenticated;
grant execute on function public.bud_bb_save_recon(jsonb) to service_role;
commit;
