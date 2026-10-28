-- 事業の収支の照合：予定日より前を探す幅を 10 日 → 25 日に（2026-10-28 東海林さん）。
-- 毎月 10 日前後に払う取引先が、Kintone では月末の予定日で入っていて取りこぼしていたため。
-- 本番は同じ日に設定表を直接 25 にしてある。作り直しても 25 になるよう、初期値と行の両方をそろえる（何度流しても同じ結果）。
alter table public.bud_bb_settings alter column date_window_before set default 25;
update public.bud_bb_settings set date_window_before = 25 where date_window_before < 25;
