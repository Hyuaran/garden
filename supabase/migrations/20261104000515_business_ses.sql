-- 事業に SES を足す（センターライズの社員）。
begin;
alter table public.root_employees drop constraint root_employees_business_check;
alter table public.root_employees add constraint root_employees_business_check
  check (business in ('ブロードバンド事業', 'NHK派遣事業', '関西電力事業', 'SES'));
insert into public.system_line_tag (kind, name, sort)
select 'business', 'SES', 4
where not exists (select 1 from public.system_line_tag where kind = 'business' and name = 'SES');
commit;
