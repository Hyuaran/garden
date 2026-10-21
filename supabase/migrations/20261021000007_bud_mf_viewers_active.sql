begin;
create or replace function public.bud_mf_apply_fetch(p_run_id uuid, p_accounts jsonb, p_transactions jsonb, p_since date, p_snapshot_date date default null, p_bank_transactions jsonb default '[]', p_until date default current_date)
returns void language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if not exists (select 1 from bud_mf_fetch_runs where id = p_run_id and ok is null for update) then raise exception 'run closed'; end if;
 -- 1 行ずつの record 変数だと「record type has not been registered」になる（2026-10-20 本番で発生）＝まとめて upsert する
 insert into bud_mf_accounts select * from jsonb_populate_recordset(null::bud_mf_accounts, p_accounts) on conflict (mf_account_id) do update set
    bank_name = excluded.bank_name, corp_code = excluded.corp_code, name = excluded.name, kind = excluded.kind, sub_account_label = excluded.sub_account_label,
    balance = excluded.balance, unjournalized_count = excluded.unjournalized_count, fetched_at = excluded.fetched_at, fiscal_start_date = excluded.fiscal_start_date;
 update bud_mf_accounts a set visible_employee_ids = array(select v from unnest(a.visible_employee_ids) v where exists (select 1 from root_employees e where e.employee_id=v and e.is_active=true and e.deleted_at is null and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)))
 where exists (select 1 from unnest(a.visible_employee_ids) v where not exists (select 1 from root_employees e where e.employee_id=v and e.is_active=true and e.deleted_at is null and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)));
 insert into bud_mf_axis_order(axis,key,sort_order)
 select 'corp', corp_code, coalesce((select max(sort_order)+1 from bud_mf_axis_order where axis='corp'),0) + row_number() over(order by corp_code)::integer - 1
 from bud_mf_accounts where kind='bank' group by corp_code on conflict do nothing;
 insert into bud_mf_axis_order(axis,key,sort_order)
 select 'bank', bank_name, coalesce((select max(sort_order)+1 from bud_mf_axis_order where axis='bank'),0) + row_number() over(order by bank_name)::integer - 1
 from bud_mf_accounts where kind='bank' group by bank_name on conflict do nothing;
 insert into bud_mf_bank_tx_seen(mf_transaction_id,mf_account_id,date,side,value,first_seen_at)
 select mf_transaction_id,mf_account_id,date,side,value,now()
 from jsonb_populate_recordset(null::bud_mf_bank_transactions,p_bank_transactions)
 on conflict (mf_transaction_id) do nothing;
 update bud_mf_accounts a set balance = case when anchor_balance is null or anchor_at is null then null else anchor_balance + coalesce((
 select sum(case when s.side='INCOME' then s.value else -s.value end) from bud_mf_bank_tx_seen s
 where s.mf_account_id=a.mf_account_id and s.first_seen_at>a.anchor_at),0) end
 where a.kind='bank' and a.balance_mode='arrival';
 if p_snapshot_date is not null then
   delete from bud_mf_balance_snapshots where snapshot_date = p_snapshot_date;
   insert into bud_mf_balance_snapshots(mf_account_id,snapshot_date,balance,taken_at)
   select mf_account_id,p_snapshot_date,balance,now() from bud_mf_accounts
   where kind='bank' and (balance_mode='auto' or (balance_mode='arrival' and anchor_balance is not null and anchor_at is not null) or (balance_mode='anchor' and anchor_balance is not null and anchor_date is not null)) and balance is not null;
 end if;
 delete from bud_mf_card_transactions where date >= p_since;
 insert into bud_mf_card_transactions select * from jsonb_populate_recordset(null::bud_mf_card_transactions, p_transactions) where date >= p_since and date <= p_until;
 delete from bud_mf_bank_transactions where date >= p_since;
 insert into bud_mf_bank_transactions select * from jsonb_populate_recordset(null::bud_mf_bank_transactions, p_bank_transactions) where date >= p_since and date <= p_until;
 update bud_mf_fetch_runs set ok = true, counts = jsonb_build_object('accounts',jsonb_array_length(p_accounts),'transactions',jsonb_array_length(p_transactions),'bank_transactions',jsonb_array_length(p_bank_transactions)) where id = p_run_id;
end $$;

revoke all on function public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date,jsonb,date) from public, anon, authenticated;
grant execute on function public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date,jsonb,date) to service_role;

create or replace function public.bud_mf_save_settings_before_mail(p_id text, p_viewers text[], p_hidden boolean, p_book text, p_mode text, p_note text, p_anchor_balance bigint default null, p_anchor_date date default null, p_anchor_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if exists (select 1 from bud_mf_fetch_runs where ok is null and ran_at > now() - interval '10 minutes') then raise exception '読み込み中です。終了後に保存してください'; end if;
 if exists (select 1 from unnest(p_viewers) v where not exists (select 1 from root_employees where employee_id = v and deleted_at is null and is_active=true and (termination_date is null or termination_date > (now() at time zone 'Asia/Tokyo')::date))) then raise exception 'invalid employee'; end if;
 delete from bud_mf_balance_snapshots where mf_account_id=p_id and exists (
 select 1 from bud_mf_accounts where mf_account_id=p_id and (book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode or anchor_balance is distinct from p_anchor_balance or anchor_date is distinct from p_anchor_date or anchor_at is distinct from p_anchor_at));
 update bud_mf_accounts set visible_employee_ids = p_viewers, hidden = p_hidden,
 balance = case when book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode or anchor_balance is distinct from p_anchor_balance or anchor_date is distinct from p_anchor_date or anchor_at is distinct from p_anchor_at then null else balance end,
 book_sub_account_name = p_book, balance_mode = p_mode, balance_note = p_note, anchor_balance = p_anchor_balance, anchor_date = p_anchor_date, anchor_at = p_anchor_at where mf_account_id = p_id;
 if not found then raise exception 'account missing'; end if;
end $$;
revoke all on function public.bud_mf_save_settings_before_mail(text,text[],boolean,text,text,text,bigint,date,timestamptz) from public,anon,authenticated;
commit;
