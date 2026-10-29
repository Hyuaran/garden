create table if not exists public.system_expense_report (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null,
  employee_name text not null,
  submitted_by uuid not null references auth.users(id),
  form text not null check (form in ('nhk','nhk-kanden','ueda')),
  business text not null,
  payment text not null check (payment in ('現金','会社クレジットカード')),
  paid_on date not null,
  amount integer not null check (amount > 0),
  purpose text not null check (purpose in ('ETC/高速代','備品代','郵送代','宿泊費','駐車場代','PITAPA','交通費 電車(現金)','会食費','ガソリン代','交通費','交通費 自転車レンタル','その他')),
  purpose_detail text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  kintone_record_id text,
  kintone_error text,
  kintone_sent_at timestamptz,
  constraint system_expense_report_business_check check (
    (form = 'nhk' and business = 'NHK') or
    (form = 'nhk-kanden' and business in ('関電','関電トス','NHK')) or
    (form = 'ueda' and business in ('関電トス','NHK','ブレーカー','取引先打合せ'))
  ),
  constraint system_expense_report_detail_check check (purpose <> 'その他' or length(btrim(purpose_detail)) > 0)
);
create index if not exists idx_system_expense_report_owner_recent on public.system_expense_report (submitted_by, created_at desc);
alter table public.system_expense_report enable row level security;
revoke all on public.system_expense_report from anon, authenticated;
grant select on public.system_expense_report to authenticated;
grant all on public.system_expense_report to service_role;
create policy system_expense_report_select on public.system_expense_report for select to authenticated using (
  public.garden_role_of(auth.uid()) = 'super_admin' or
  (submitted_by = auth.uid() and exists (
    select 1 from public.root_employees e where e.user_id = auth.uid() and e.is_active = true and e.deleted_at is null
      and (e.termination_date is null or e.termination_date > (now() at time zone 'Asia/Tokyo')::date)
  ))
);

-- 画面ごとの閲覧権限（歯車）の対象に足す。既定は在籍者全員
insert into public.system_view_scopes(page_key,tab_key,label,default_roles)
values ('system-expense','','経費 報告',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[])
on conflict do nothing;
