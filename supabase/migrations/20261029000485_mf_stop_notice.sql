-- 作成のみ。本番適用は初回確認後に実施する。
alter table public.root_employees
  add column if not exists mf_stop_notified_at timestamptz;

comment on column public.root_employees.mf_stop_notified_at
  is 'MF アカウント停止依頼を Chatwork に送信した日時';
