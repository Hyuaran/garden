begin;
create table public.bud_bb_settings (
 id boolean primary key default true check (id),
 record_master text not null default 'kintone' check (record_master in ('kintone','garden')),
 recon_from date not null default '2025-04-01', notify_from date not null default '2026-10-01',
 date_window_before integer not null default 10 check (date_window_before >= 0),
 date_window_after integer not null default 7 check (date_window_after >= 0),
 excluded_partners text[] not null default array['代理店支払い合計','関電経費合計'],
 run_token uuid, run_until timestamptz
);
insert into public.bud_bb_settings(id) values(true);
create function public.bud_bb_claim(p_token uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 update bud_bb_settings set run_token=p_token,run_until=now()+interval '10 minutes' where id and (run_until is null or run_until < now());
 return found;
end $$;
create function public.bud_bb_release(p_token uuid) returns void language sql security definer set search_path=public as $$
 update bud_bb_settings set run_token=null,run_until=null where id and run_token=p_token;
$$;
revoke all on function public.bud_bb_claim(uuid), public.bud_bb_release(uuid) from public,anon,authenticated;
grant execute on function public.bud_bb_claim(uuid), public.bud_bb_release(uuid) to service_role;
create table public.bud_bb_records (
 kintone_record_id text primary key, revision text not null,
 source text not null default 'kintone' check (source in ('kintone','garden')),
 business text not null, partner text not null, product text not null, payment_type text not null,
 scheduled_date date, actual_period date, tax_rate numeric, sales_net numeric, payment_net numeric,
 payment_gross numeric, profit_net numeric, confirmation text not null,
 mf_company text not null, mf_bank text not null, mf_content text not null, mf_date date, mf_amount numeric,
 mf_transaction_id text unique, updated_at timestamptz not null, raw jsonb not null
);
create table public.bud_bb_payee_rules (partner text primary key, keywords text[] not null);
create table public.bud_bb_recon_issues (
 kintone_record_id text not null, kind text not null check(kind in ('amount_mismatch','not_arrived','ambiguous')),
 content text not null, opened_at timestamptz not null default now(), notified_at timestamptz,
 resolved_at timestamptz, resolved_notified_at timestamptz,
 primary key(kintone_record_id,kind)
);
-- The full snapshot replacement is atomic, including deletion of removed records.
create function public.bud_bb_replace_mirror(p_rows jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(hashtext('bud_bb_recon'));
 insert into bud_bb_records select * from jsonb_populate_recordset(null::bud_bb_records,p_rows)
 on conflict(kintone_record_id) do update set revision=excluded.revision, source=excluded.source,
 business=excluded.business, partner=excluded.partner, product=excluded.product, payment_type=excluded.payment_type,
 scheduled_date=excluded.scheduled_date, actual_period=excluded.actual_period, tax_rate=excluded.tax_rate,
 sales_net=excluded.sales_net, payment_net=excluded.payment_net, payment_gross=excluded.payment_gross,
 profit_net=excluded.profit_net, confirmation=excluded.confirmation, mf_company=excluded.mf_company,
 mf_bank=excluded.mf_bank,mf_content=excluded.mf_content,mf_date=excluded.mf_date,mf_amount=excluded.mf_amount,
 updated_at=excluded.updated_at,raw=excluded.raw;
 delete from bud_bb_records where source='kintone' and kintone_record_id not in (select r->>'kintone_record_id' from jsonb_array_elements(p_rows) r);
end $$;
revoke all on function public.bud_bb_replace_mirror(jsonb) from public,anon,authenticated;
grant execute on function public.bud_bb_replace_mirror(jsonb) to service_role;
do $$ declare t text; begin
 foreach t in array array['bud_bb_settings','bud_bb_records','bud_bb_payee_rules','bud_bb_recon_issues'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy bb_admin_read on public.%I for select to authenticated using (public.bud_has_access() and public.bud_is_admin_or_super_admin())',t);
 end loop;
end $$;
commit;
