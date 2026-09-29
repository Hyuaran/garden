-- 電話番号台帳の自動の掃除（autovacuum）を早める（2026-09-29）。
-- 既定の部分索引（soil_list_phone_default_cover_idx）で件数を「索引だけ」で数えるには、台帳の visibility map が新しい必要がある。
-- 既定（表の 20%＝約 53 万行の変更）だと、通話記録の反映・受注の取り込みの更新が 2 日で 43 万行たまり、件数が 0.8 秒 → 7 秒に戻っていた。
-- 0.5%（約 1.3 万行）で掃除を走らせる。掃除は 1 回 40 秒ほど（2026-09-27 実測）。
alter table public.soil_list_phone set (
  autovacuum_vacuum_scale_factor = 0.005,
  autovacuum_vacuum_insert_scale_factor = 0.005
);
