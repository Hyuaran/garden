-- 履歴検索（/api/soil/list/history）の突合に索引を付ける（2026-09-15 Claude・本番適用済み）
-- 電話番号台帳の「携帯番号 = $1」と、通話記録・新営業の「数字だけにした電話番号 = 対象番号」の結合が
-- 索引なしだと 267 万件・53 万件・5.9 万件の全走査になり、本番で 16.8 秒かかっていた。
begin;

create index if not exists soil_list_phone_mobile_idx
  on public.soil_list_phone ("携帯番号");

-- 式索引は history-sql.ts の結合条件と同じ式でないと使われない（regexp_replace(coalesce(列, ''), '\D', '', 'g')）
create index if not exists system_call_history_phone_digits_idx
  on public.system_call_history (regexp_replace(coalesce(phone_number, ''), '\D', '', 'g'));

create index if not exists system_fm_shineigyo_phone_digits_idx
  on public.system_fm_shineigyo (regexp_replace(coalesce("電話番号", ''), '\D', '', 'g'));

create index if not exists system_fm_shineigyo_mobile_digits_idx
  on public.system_fm_shineigyo (regexp_replace(coalesce("携帯番号", ''), '\D', '', 'g'));

comment on index public.soil_list_phone_mobile_idx is '履歴検索の「携帯番号でも探す」用。';
comment on index public.system_call_history_phone_digits_idx is '履歴検索用。通話記録の電話番号を数字だけにした式索引。';
comment on index public.system_fm_shineigyo_phone_digits_idx is '履歴検索用。新営業の電話番号を数字だけにした式索引。';
comment on index public.system_fm_shineigyo_mobile_digits_idx is '履歴検索用。新営業の携帯番号を数字だけにした式索引。';

commit;
