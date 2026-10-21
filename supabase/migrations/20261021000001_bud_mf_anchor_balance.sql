alter table public.bud_mf_accounts add column anchor_balance bigint, add column anchor_date date;
alter table public.bud_mf_accounts drop constraint bud_mf_accounts_balance_mode_check;
alter table public.bud_mf_accounts add constraint bud_mf_accounts_balance_mode_check check (balance_mode in ('auto','manual_check','anchor'));
drop function public.bud_mf_save_settings(text,text[],boolean,text,text,text);
create function public.bud_mf_save_settings(p_id text, p_viewers text[], p_hidden boolean, p_book text, p_mode text, p_note text, p_anchor_balance bigint default null, p_anchor_date date default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if exists (select 1 from bud_mf_fetch_runs where ok is null and ran_at > now() - interval '10 minutes') then raise exception '読み込み中です。終了後に保存してください'; end if;
 if exists (select 1 from unnest(p_viewers) v where not exists (select 1 from root_employees where employee_id = v and deleted_at is null)) then raise exception 'invalid employee'; end if;
 delete from bud_mf_balance_snapshots where mf_account_id=p_id and exists (
 select 1 from bud_mf_accounts where mf_account_id=p_id and (book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode or anchor_balance is distinct from p_anchor_balance or anchor_date is distinct from p_anchor_date));
 update bud_mf_accounts set visible_employee_ids = p_viewers, hidden = p_hidden,
 balance = case when book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode or anchor_balance is distinct from p_anchor_balance or anchor_date is distinct from p_anchor_date then null else balance end,
 book_sub_account_name = p_book, balance_mode = p_mode, balance_note = p_note, anchor_balance = p_anchor_balance, anchor_date = p_anchor_date where mf_account_id = p_id;
 if not found then raise exception 'account missing'; end if;
end $$;
revoke all on function public.bud_mf_save_settings(text,text[],boolean,text,text,text,bigint,date) from public,anon,authenticated;
grant execute on function public.bud_mf_save_settings(text,text[],boolean,text,text,text,bigint,date) to authenticated;

create or replace function public.bud_mf_apply_fetch(p_run_id uuid, p_accounts jsonb, p_transactions jsonb, p_since date, p_snapshot_date date default null)
returns void language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if not exists (select 1 from bud_mf_fetch_runs where id = p_run_id and ok is null for update) then raise exception 'run closed'; end if;
 -- 1 行ずつの record 変数だと「record type has not been registered」になる（2026-10-20 本番で発生）＝まとめて upsert する
 insert into bud_mf_accounts select * from jsonb_populate_recordset(null::bud_mf_accounts, p_accounts) on conflict (mf_account_id) do update set
    bank_name = excluded.bank_name, corp_code = excluded.corp_code, name = excluded.name, kind = excluded.kind, sub_account_label = excluded.sub_account_label,
    balance = excluded.balance, unjournalized_count = excluded.unjournalized_count, fetched_at = excluded.fetched_at;
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
 insert into bud_mf_card_transactions select * from jsonb_populate_recordset(null::bud_mf_card_transactions, p_transactions) where date >= p_since;
 update bud_mf_fetch_runs set ok = true, counts = jsonb_build_object('accounts',jsonb_array_length(p_accounts),'transactions',jsonb_array_length(p_transactions)) where id = p_run_id;
end $$;
