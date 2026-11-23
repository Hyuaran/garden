-- TimeTree にしか無い案件（申込書が届く前＝FileMaker 未入力）を受注として持つ（2026-11-23 東海林さん）
-- 「現状の運用では、申込書が来てからのものしか FileMaker に入力していない。諸元待ちや手元にくるまでの間のキャンセルはタイムツリーにしかない」
begin;
alter table public.leaf_kanden_orders drop constraint leaf_kanden_orders_source_check;
alter table public.leaf_kanden_orders add constraint leaf_kanden_orders_source_check
  check (source = any (array['filemaker'::text, 'garden'::text, 'timetree'::text]));
alter table public.leaf_kanden_orders add column if not exists timetree_event_id text;
create unique index if not exists leaf_kanden_orders_timetree_event_uniq
  on public.leaf_kanden_orders (timetree_event_id) where timetree_event_id is not null;
commit;
