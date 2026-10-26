-- Codex-444: 作成のみ。本番 DB には適用しない。
begin;
-- お金の画面では、閲覧者による追加は無効。変更・追加は全権管理者だけ。
alter table public.system_view_permissions add constraint bud_viewers_cannot_add
 check (page_key not like 'bud-%' or viewers_can_add=false);
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('bud-dashboard','','ダッシュボード',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-dashboard','overview','全体',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-receivables','','入金管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-invoices','','請求書管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-invoices','issued','発行',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-invoices','received','受領',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-invoices','templates','テンプレ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-invoices','partners','取引先',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','','経費精算',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','submit','承認待ち',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','approve','完了待ち',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','booking','仕訳待ち',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','done','完了',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','list','一覧',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-expenses','deleted','削除済み',array['super_admin']::text[]),
 ('bud-expenses','categories','区分マスタ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','','給与管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','monthly','月次給与',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','history','給与履歴',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','bonus','賞与',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','yearend','年末調整',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-payroll','master','マスタ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','','振込管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','overview','全体',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','approval','承認待ち',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','schedule','振込予定',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','history','実行履歴',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','list','一覧',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-transfers','master','振込先マスタ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-journal','','仕訳帳',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-journal','import','取込',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-journal','edit','明細編集',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-journal','export','弥生エクスポート',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-journal','master','マスタ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-statements','','明細',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-statements','list','明細',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-statements','imports','取込履歴',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-statements','summary','月次集計',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-profit','','損益管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-profit','monthly','月次',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-profit','trends','推移',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-profit','comparison','比較',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-profit','trial','試算表',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','','マスタ管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','journal','共通仕訳',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','intercompany','法人間取引',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','partners','取引先',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','payroll','給与計算式',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-masters','categories','経費区分',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-audit','','監査ログ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-audit','all','全ログ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-audit','critical','重要操作',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-audit','errors','エラー',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-audit','role-changes','ロール変更',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-settings','','設定',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-settings','roles','ロール',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-settings','notifications','通知',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-settings','yayoi','弥生連携',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bud-settings','misc','その他',array['staff','outsource','manager','admin','super_admin']::text[]);

-- Bud 固有の既定（最低役職 + bud_users）を残す。書き込み用ヘルパーは変更しない。
create function public.bud_can_view_scope(p_page text,p_tab text default '') returns boolean
language plpgsql stable security definer set search_path=public as $$
declare employee public.root_employees%rowtype; setting public.system_view_permissions%rowtype; defaults text[];
begin
 select default_roles into defaults from public.system_view_scopes where page_key=p_page and tab_key=p_tab and page_key like 'bud-%';
 if not found then return false; end if;
 select * into employee from public.root_employees where user_id=auth.uid() and is_active=true and deleted_at is null
  and (termination_date is null or termination_date > (now() at time zone 'Asia/Tokyo')::date);
 if not found then return false; end if;
 if employee.garden_role='super_admin' then return true; end if;
 select * into setting from public.system_view_permissions where page_key=p_page and tab_key in ('',p_tab)
  order by (tab_key=p_tab) desc limit 1;
 if found then return employee.garden_role=any(setting.roles) or employee.employee_id=any(setting.employee_ids); end if;
 return employee.garden_role=any(defaults) and public.bud_has_access();
end $$;
create function public.bud_can_read_page(p_page text) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.system_view_scopes s where s.page_key=p_page and s.page_key like 'bud-%'
  and (s.tab_key<>'' or not exists(select 1 from public.system_view_scopes t where t.page_key=p_page and t.tab_key<>''))
  and public.bud_can_view_scope(s.page_key,s.tab_key));
$$;
revoke all on function public.bud_can_view_scope(text,text),public.bud_can_read_page(text) from public,anon;
grant execute on function public.bud_can_view_scope(text,text),public.bud_can_read_page(text) to authenticated;

-- REST 直読みも制限。SELECT の追加制限だけなので、書き込み権限は増えない。
-- 口座残高・事業の収支のテーブル・RPC・閲覧者設定には触れない。
do $$
declare item record;
begin
 for item in select * from (values
  ('bud_transfers','public.bud_can_view_scope(''bud-transfers'',''overview'') or public.bud_can_view_scope(''bud-transfers'',''approval'') or public.bud_can_view_scope(''bud-transfers'',''schedule'') or public.bud_can_view_scope(''bud-transfers'',''history'') or public.bud_can_view_scope(''bud-transfers'',''list'')'),
  ('bud_transfer_status_history','public.bud_can_read_page(''bud-transfers'')'),
  ('bud_transfer_inbox','public.bud_can_view_scope(''bud-transfers'',''approval'')'),
  ('bud_statements','public.bud_can_view_scope(''bud-statements'',''list'') or public.bud_can_view_scope(''bud-statements'',''summary'')'),
  ('bud_statement_import_batches','public.bud_can_view_scope(''bud-statements'',''imports'')'),
  ('bud_salary_batches','public.bud_can_read_page(''bud-payroll'')'),
  ('bud_salary_details','public.bud_can_read_page(''bud-payroll'')')
 ) as rules(table_name,condition)
 loop
  if to_regclass('public.'||item.table_name) is not null then
   execute format('create policy bud_view_scope_read on public.%I as restrictive for select to authenticated using (%s)',item.table_name,item.condition);
  end if;
 end loop;
end $$;
-- 申請者本人のモバイル入口を維持し、経理用の全件読み取りにはタブ判定を加える。
create policy bud_view_scope_read on public.bud_expense_requests as restrictive for select to authenticated using (
 applicant_employee_id in (select employee_id from public.root_employees where user_id=auth.uid())
 or (deleted_at is not null and public.bud_can_view_scope('bud-expenses','deleted'))
 or (deleted_at is null and (
  public.bud_can_view_scope('bud-expenses','list')
  or (status in ('submitted','final_pending','final_returned','journalize_pending','journalized','keiri_returned') and public.bud_can_view_scope('bud-expenses','submit'))
  or (status='final_pending' and public.bud_can_view_scope('bud-expenses','approve'))
  or (status in ('journalize_pending','journalized') and public.bud_can_view_scope('bud-expenses','booking'))
  or (status='journalized' and public.bud_can_view_scope('bud-expenses','done'))
 ))
);
-- 既存の完了集計 RPC は security invoker。SELECT の追加制限も適用される。
commit;
