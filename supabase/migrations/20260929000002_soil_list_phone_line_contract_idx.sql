-- 記録用。本番は Claude が create index concurrently で作成済み（2026-09-29）。トランザクションの外で流すこと。
-- 件数「既定条件＋元回線＋経過年数（契約時期）」が台帳本体をディスクから読んで 1 回目 3.6 秒 → この索引だけで数えて 0.02 秒（13 MB）。
-- 同時に試した ("リスト名") の部分索引は使われず、無理に使わせると遅くなったので作らない。
create index concurrently if not exists soil_list_phone_default_line_contract_idx
on public.soil_list_phone ("元回線", "契約時期")
where "AU光架電可否" = '○'
  and ("アポ禁" is null or "アポ禁" = '')
  and "自社アポ禁" = false;
