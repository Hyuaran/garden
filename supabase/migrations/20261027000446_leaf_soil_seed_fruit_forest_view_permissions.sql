-- Codex-446: 作成のみ。本番 DB には適用しない。
begin;
alter table public.system_view_permissions add constraint leaf_forest_viewers_cannot_add
 check ((page_key not like 'leaf-%' and page_key not like 'forest-%') or viewers_can_add=false);
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('leaf-overview','','Leaf',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('leaf-kanden','','関電',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('leaf-kanden-input','','関電・入力',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('leaf-kanden-backoffice','','関電・事務',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('soil-overview','','Soil',array['admin','super_admin']::text[]),
 ('seed-overview','','Seed',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('fruit-overview','','Fruit',array['manager','admin','super_admin']::text[]),
 ('forest-dashboard','','ダッシュボード',array['manager','admin','super_admin']::text[]),
 ('forest-company-overview','','会社概要',array['manager','admin','super_admin']::text[]),
 ('forest-financial-statements','','決算書',array['manager','admin','super_admin']::text[]),
 ('forest-registration-change','','登記変更',array['manager','admin','super_admin']::text[]),
 ('forest-reports','','レポート分析',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki','','進行期',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki-company','','法人の進行期',array['manager','admin','super_admin']::text[]),
 ('forest-journal','','仕訳帳',array['manager','admin','super_admin']::text[]),
 ('forest-balances','','残高一覧',array['manager','admin','super_admin']::text[]),
 ('forest-journal-company','','法人の仕訳帳',array['manager','admin','super_admin']::text[]),
 ('forest-journal-review','','仕訳の確認',array['manager','admin','super_admin']::text[]),
 ('leaf-kanden-input','myprofile','マイページ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('leaf-kanden-input','input','新規送信',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('leaf-kanden-input','mypage','案件一覧',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('forest-dashboard','overview','概要',array['manager','admin','super_admin']::text[]),
 ('forest-dashboard','matrix','6法人マトリクス',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki','numbers','数値更新',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki','rollover','期の切り替え',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki-company','numbers','数値更新',array['manager','admin','super_admin']::text[]),
 ('forest-shinkouki-company','rollover','期の切り替え',array['manager','admin','super_admin']::text[]);
create function public.forest_can_read_scope(p_page text,p_tab text default '') returns boolean
language plpgsql stable security definer set search_path=public as $$
declare employee public.root_employees%rowtype; setting public.system_view_permissions%rowtype; defaults text[];
begin
 select default_roles into defaults from public.system_view_scopes where page_key=p_page and tab_key=p_tab and page_key like 'forest-%';
 if not found then return false; end if;
 select * into employee from public.root_employees where user_id=auth.uid() and is_active=true and deleted_at is null
 and (termination_date is null or termination_date > (now() at time zone 'Asia/Tokyo')::date);
 if not found then return false; end if;
 if employee.garden_role='super_admin' then return true; end if;
 select * into setting from public.system_view_permissions where page_key=p_page and tab_key in ('',p_tab) order by (tab_key=p_tab) desc limit 1;
 if found then return employee.garden_role=any(setting.roles) or employee.employee_id=any(setting.employee_ids); end if;
 return employee.garden_role=any(defaults) and exists(select 1 from public.forest_users where user_id=auth.uid());
end $$;
revoke all on function public.forest_can_read_scope(text,text) from public,anon;
grant execute on function public.forest_can_read_scope(text,text) to authenticated;
do $$
declare table_name text; read_condition text;
begin
 foreach table_name in array array['companies','fiscal_periods','shinkouki','forest_hankanhi'] loop
 if to_regclass('public.'||table_name) is not null then
 read_condition := 'public.forest_can_read_scope(''forest-dashboard'',''matrix'')';
 if table_name <> 'forest_hankanhi' then
  read_condition := read_condition || ' or public.forest_can_read_scope(''forest-dashboard'',''overview'')';
 end if;
 if table_name in ('companies','shinkouki') then
  read_condition := read_condition || ' or public.forest_can_read_scope(''forest-shinkouki'',''numbers'') or public.forest_can_read_scope(''forest-shinkouki'',''rollover'') or public.forest_can_read_scope(''forest-shinkouki-company'',''numbers'') or public.forest_can_read_scope(''forest-shinkouki-company'',''rollover'')';
 end if;
 execute format('create policy forest_view_scope_read on public.%I as restrictive for select to authenticated using (%s)',table_name,read_condition);
 end if;
 end loop;
end $$;
-- 仕訳帳の Bearer API、外部取り込み、書き込み policy は変更しない。
commit;
