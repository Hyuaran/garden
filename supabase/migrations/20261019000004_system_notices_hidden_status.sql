-- お知らせの状態を 3 つに：draft＝未確認（まだ決めていない）／published＝公開する／hidden＝公開しない（わざと出さないと決めた）
-- 東海林さん 2026-10-19「公開する・公開しない・未確認の 3 つのラジオボタンにして、意思のある公開しないは未確認だけ表示に拾われないように」
alter table public.system_notices drop constraint if exists system_notices_status_check;
alter table public.system_notices add constraint system_notices_status_check check (status in ('draft','published','hidden'));
