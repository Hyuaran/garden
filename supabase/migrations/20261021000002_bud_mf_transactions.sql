alter table public.bud_mf_accounts add column fiscal_start_date date;
create table public.bud_mf_bank_transactions (
 mf_transaction_id text primary key, mf_account_id text not null references public.bud_mf_accounts(mf_account_id),
 date date not null, content text not null, value numeric not null, side text not null check (side in ('INCOME','EXPENSE')),
 journalizing_status text not null, fetched_at timestamptz not null
);
create index on public.bud_mf_bank_transactions(mf_account_id,date desc);
alter table public.bud_mf_bank_transactions enable row level security;
create policy mf_bank_transactions_read on public.bud_mf_bank_transactions for select to authenticated using (
 exists (select 1 from public.bud_mf_accounts a where a.mf_account_id = bud_mf_bank_transactions.mf_account_id)
);
revoke all on public.bud_mf_bank_transactions from anon, authenticated;
grant select on public.bud_mf_bank_transactions to authenticated;
grant all on public.bud_mf_bank_transactions to service_role;
drop function public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date);
create function public.bud_mf_apply_fetch(p_run_id uuid, p_accounts jsonb, p_transactions jsonb, p_since date, p_snapshot_date date default null, p_bank_transactions jsonb default '[]', p_until date default current_date)
returns void language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if not exists (select 1 from bud_mf_fetch_runs where id = p_run_id and ok is null for update) then raise exception 'run closed'; end if;
 -- 1 行ずつの record 変数だと「record type has not been registered」になる（2026-10-20 本番で発生）＝まとめて upsert する
 insert into bud_mf_accounts select * from jsonb_populate_recordset(null::bud_mf_accounts, p_accounts) on conflict (mf_account_id) do update set
    bank_name = excluded.bank_name, corp_code = excluded.corp_code, name = excluded.name, kind = excluded.kind, sub_account_label = excluded.sub_account_label,
    balance = excluded.balance, unjournalized_count = excluded.unjournalized_count, fetched_at = excluded.fetched_at, fiscal_start_date = excluded.fiscal_start_date;
 insert into bud_mf_axis_order(axis,key,sort_order)
 select 'corp', corp_code, coalesce((select max(sort_order)+1 from bud_mf_axis_order where axis='corp'),0) + row_number() over(order by corp_code)::integer - 1
 from bud_mf_accounts where kind='bank' group by corp_code on conflict do nothing;
 insert into bud_mf_axis_order(axis,key,sort_order)
 select 'bank', bank_name, coalesce((select max(sort_order)+1 from bud_mf_axis_order where axis='bank'),0) + row_number() over(order by bank_name)::integer - 1
 from bud_mf_accounts where kind='bank' group by bank_name on conflict do nothing;
 if p_snapshot_date is not null then
   delete from bud_mf_balance_snapshots where snapshot_date = p_snapshot_date;
   insert into bud_mf_balance_snapshots(mf_account_id,snapshot_date,balance,taken_at)
   select mf_account_id,p_snapshot_date,balance,now() from bud_mf_accounts
   where kind='bank' and (balance_mode='auto' or (balance_mode='anchor' and anchor_balance is not null and anchor_date is not null)) and balance is not null;
 end if;
 delete from bud_mf_card_transactions where true; -- Supabase は WHERE の無い DELETE を断る
 insert into bud_mf_card_transactions select * from jsonb_populate_recordset(null::bud_mf_card_transactions, p_transactions) where date >= p_since and date <= p_until;
 delete from bud_mf_bank_transactions where true;
 insert into bud_mf_bank_transactions select * from jsonb_populate_recordset(null::bud_mf_bank_transactions, p_bank_transactions) where date >= p_since and date <= p_until;
 update bud_mf_fetch_runs set ok = true, counts = jsonb_build_object('accounts',jsonb_array_length(p_accounts),'transactions',jsonb_array_length(p_transactions),'bank_transactions',jsonb_array_length(p_bank_transactions)) where id = p_run_id;
end $$;

revoke all on function public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date,jsonb,date) from public, anon, authenticated;
grant execute on function public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date,jsonb,date) to service_role;
