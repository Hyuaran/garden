-- リストマスタ：リスト名の「含む」検索（ilike '%…%'）を速くするための trigram 索引
-- 2026-09-13 実測：索引なしだと 267 万件を毎回なめて 26〜41 秒（REST の 8 秒はもちろん、DB 直結の 60 秒も危うい）
-- pg_trgm（Supabase に同梱・1.6）を有効にし、リスト名に GIN 索引を張る。作成は Claude が DB 直結で行う（数分）。
begin;

create extension if not exists pg_trgm with schema extensions;

commit;

-- 索引の作成はトランザクションの外で CONCURRENTLY（作成中も画面が止まらないように）
create index concurrently if not exists soil_list_phone_list_name_trgm_idx
  on public.soil_list_phone using gin ("リスト名" extensions.gin_trgm_ops);

comment on index public.soil_list_phone_list_name_trgm_idx is 'リスト名の「含む」検索用（ilike %…%）。2026-09-13';
