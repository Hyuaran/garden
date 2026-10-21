-- 同じ取引先の複数の行が 1 回の振込でまとめて入ることがある（Crescere の 101＋103 など）。
-- 1 つの口座の明細を複数の行に結び付けられるよう、mf_transaction_id の一意の制約を外す
alter table public.bud_bb_records drop constraint if exists bud_bb_records_mf_transaction_id_key;
create index if not exists bud_bb_records_mf_transaction_id_idx on public.bud_bb_records(mf_transaction_id);
