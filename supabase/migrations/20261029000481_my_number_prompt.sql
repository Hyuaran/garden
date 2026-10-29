-- 本番への適用は別途実施。本人提出は既存の source='liff' と同じ扱い。
alter table public.root_employees add column if not exists my_number_deferred_on date;
comment on column public.root_employees.my_number_deferred_on is 'マイナンバー提出案内をあとでにした日（日本時間）';
