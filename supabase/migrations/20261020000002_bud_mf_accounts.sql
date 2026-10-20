create table public.bud_mf_accounts (
 bank_name text not null, corp_code text not null, mf_account_id text primary key, name text not null, kind text not null check (kind in ('bank','card')),
 sub_account_label text not null default '', sort_order integer not null, hidden boolean not null default false,
 visible_employee_ids text[] not null default '{}', book_sub_account_name text not null default '',
 balance_mode text not null default 'manual_check' check (balance_mode in ('auto','manual_check')),
 balance_note text not null default '', balance numeric, unjournalized_count integer not null default 0,
 fetched_at timestamptz not null
);
create table public.bud_mf_card_transactions (
 mf_transaction_id text primary key, mf_account_id text not null references public.bud_mf_accounts(mf_account_id),
 date date not null, content text not null, value numeric not null, side text not null check (side in ('INCOME','EXPENSE')),
 journalizing_status text not null, fetched_at timestamptz not null
);
create index on public.bud_mf_card_transactions(mf_account_id,date desc);
create table public.bud_mf_fetch_runs (
 id uuid primary key default gen_random_uuid(), ran_at timestamptz not null default now(),
 trigger text not null check (trigger in ('cron','button')), ok boolean, error text, counts jsonb not null default '{}'
);
alter table public.bud_mf_accounts enable row level security;
alter table public.bud_mf_card_transactions enable row level security;
alter table public.bud_mf_fetch_runs enable row level security;
create policy mf_accounts_read on public.bud_mf_accounts for select to authenticated using (
 public.bud_has_access() and (public.bud_is_super_admin() or (not hidden and exists (
 select 1 from public.root_employees e where e.user_id = auth.uid() and e.deleted_at is null and e.employee_id = any(visible_employee_ids))))
);
create policy mf_accounts_settings on public.bud_mf_accounts for update to authenticated
 using (public.bud_has_access() and public.bud_is_super_admin()) with check (public.bud_has_access() and public.bud_is_super_admin());
create policy mf_transactions_read on public.bud_mf_card_transactions for select to authenticated using (
 exists (select 1 from public.bud_mf_accounts a where a.mf_account_id = bud_mf_card_transactions.mf_account_id)
);
create policy mf_runs_read on public.bud_mf_fetch_runs for select to authenticated using (public.bud_has_access() and public.bud_is_super_admin());
revoke all on public.bud_mf_accounts, public.bud_mf_card_transactions, public.bud_mf_fetch_runs from anon, authenticated;
grant select on public.bud_mf_accounts, public.bud_mf_card_transactions, public.bud_mf_fetch_runs to authenticated;
-- Settings are updated only through the checked functions below.
grant all on public.bud_mf_accounts, public.bud_mf_card_transactions, public.bud_mf_fetch_runs to service_role;


create table public.bud_mf_axis_order (
 axis text not null check (axis in ('corp','bank')), key text not null, sort_order integer not null, primary key(axis,key)
);
create table public.bud_mf_balance_snapshots (
 mf_account_id text not null references public.bud_mf_accounts(mf_account_id), snapshot_date date not null,
 balance numeric not null, taken_at timestamptz not null, primary key(mf_account_id,snapshot_date)
);
alter table public.bud_mf_axis_order enable row level security;
alter table public.bud_mf_balance_snapshots enable row level security;
create policy mf_axis_read on public.bud_mf_axis_order for select to authenticated using (public.bud_has_access());
create policy mf_snapshots_read on public.bud_mf_balance_snapshots for select to authenticated using (
 exists (select 1 from public.bud_mf_accounts a where a.mf_account_id = bud_mf_balance_snapshots.mf_account_id)
);
revoke all on public.bud_mf_axis_order, public.bud_mf_balance_snapshots from anon, authenticated;
grant select on public.bud_mf_axis_order, public.bud_mf_balance_snapshots to authenticated;
grant all on public.bud_mf_axis_order, public.bud_mf_balance_snapshots to service_role;

-- Serialize starts across server instances, and apply the one-minute button limit globally.
create function public.bud_mf_begin_fetch(p_trigger text) returns uuid language plpgsql security definer set search_path = public as $$
declare run_id uuid;
begin
 perform pg_advisory_xact_lock(hashtext('bud_mf_fetch'));
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if p_trigger not in ('cron','button') then raise exception 'invalid trigger'; end if;
 if exists (select 1 from bud_mf_fetch_runs where ok is null and ran_at > now() - interval '10 minutes')
 or (p_trigger = 'button' and exists (select 1 from bud_mf_fetch_runs where trigger = 'button' and ran_at > now() - interval '1 minute')) then return null; end if;
 update bud_mf_fetch_runs set ok = false, error = '読み込みが中断されました' where ok is null;
 insert into bud_mf_fetch_runs(trigger) values(p_trigger) returning id into run_id;
 return run_id;
end $$;

-- One transaction: a failed insert never replaces any previously displayed snapshot.
create function public.bud_mf_apply_fetch(p_run_id uuid, p_accounts jsonb, p_transactions jsonb, p_since date, p_snapshot_date date default null)
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
   where kind='bank' and balance_mode='auto' and balance is not null;
 end if;
 delete from bud_mf_card_transactions where true; -- Supabase は WHERE の無い DELETE を断る
 insert into bud_mf_card_transactions select * from jsonb_populate_recordset(null::bud_mf_card_transactions, p_transactions) where date >= p_since;
 update bud_mf_fetch_runs set ok = true, counts = jsonb_build_object('accounts',jsonb_array_length(p_accounts),'transactions',jsonb_array_length(p_transactions)) where id = p_run_id;
end $$;

-- Atomic ordering, checked against all accounts to prevent partial or duplicate lists.
create function public.bud_mf_reorder(p_ids text[]) returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if cardinality(p_ids) <> (select count(*) from bud_mf_accounts)
 or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) x)
 or exists (select 1 from unnest(p_ids) x where not exists (select 1 from bud_mf_accounts where mf_account_id = x)) then raise exception 'invalid order'; end if;
 update bud_mf_accounts a set sort_order = x.n - 1 from unnest(p_ids) with ordinality x(id,n) where a.mf_account_id = x.id;
end $$;

-- Changing a mapping hides its old number until the next successful read.
create function public.bud_mf_save_settings(p_id text, p_viewers text[], p_hidden boolean, p_book text, p_mode text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if exists (select 1 from bud_mf_fetch_runs where ok is null and ran_at > now() - interval '10 minutes') then raise exception '読み込み中です。終了後に保存してください'; end if;
 if exists (select 1 from unnest(p_viewers) v where not exists (select 1 from root_employees where employee_id = v and deleted_at is null)) then raise exception 'invalid employee'; end if;
 delete from bud_mf_balance_snapshots where mf_account_id=p_id and exists (
 select 1 from bud_mf_accounts where mf_account_id=p_id and (book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode));
 update bud_mf_accounts set visible_employee_ids = p_viewers, hidden = p_hidden,
 balance = case when book_sub_account_name is distinct from p_book or balance_mode is distinct from p_mode then null else balance end,
 book_sub_account_name = p_book, balance_mode = p_mode, balance_note = p_note where mf_account_id = p_id;
 if not found then raise exception 'account missing'; end if;
end $$;
revoke all on function public.bud_mf_begin_fetch(text), public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date), public.bud_mf_reorder(text[]), public.bud_mf_save_settings(text,text[],boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.bud_mf_begin_fetch(text), public.bud_mf_apply_fetch(uuid,jsonb,jsonb,date,date) to service_role;
grant execute on function public.bud_mf_reorder(text[]), public.bud_mf_save_settings(text,text[],boolean,text,text,text) to authenticated;

create function public.bud_mf_reorder_axis(p_axis text, p_keys text[]) returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.bud_has_access() or not public.bud_is_super_admin() then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext('bud_mf_settings'));
 if p_axis not in ('corp','bank') or p_keys is null
 or cardinality(p_keys) <> (select count(*) from bud_mf_axis_order where axis=p_axis)
 or cardinality(p_keys) <> (select count(distinct x) from unnest(p_keys) x)
 or exists (select 1 from unnest(p_keys) x where not exists (select 1 from bud_mf_axis_order where axis=p_axis and key=x)) then raise exception 'invalid order'; end if;
 update bud_mf_axis_order a set sort_order=x.n-1 from unnest(p_keys) with ordinality x(key,n) where a.axis=p_axis and a.key=x.key;
end $$;
revoke all on function public.bud_mf_reorder_axis(text,text[]) from public,anon,authenticated;
grant execute on function public.bud_mf_reorder_axis(text,text[]) to authenticated;
