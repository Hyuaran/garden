begin;

alter table root_employees add column if not exists chatwork_account_id text;
alter table root_employees add constraint root_employees_chatwork_account_id_digits
  check (chatwork_account_id is null or chatwork_account_id ~ '^[0-9]{1,12}$');
comment on column root_employees.chatwork_account_id is 'Chatwork のアカウント ID（[To:ID] に使う数字）';

alter table sprout_baitoru_settings
  add column if not exists mention_employee_ids text[] not null default '{}';

commit;