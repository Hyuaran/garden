-- Codex-448: 作成のみ。本番 DB には適用しない。
begin;
alter table public.system_view_permissions add constraint bloom_viewers_cannot_add
 check (page_key not like 'bloom-%' or viewers_can_add=false);
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('bloom-home','','ホーム',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-blueprint','','設計図',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-blueprint','overview','全体',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-blueprint','modules','モジュール',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-ceo-status','','経営状況',array['super_admin']::text[]),
 ('bloom-ceo-status','overview','全体',array['super_admin']::text[]),
 ('bloom-ceo-status','performance','業績',array['super_admin']::text[]),
 ('bloom-ceo-status','decisions','判断・会議',array['super_admin']::text[]),
 ('bloom-ceo-status','settings','設定',array['super_admin']::text[]),
 ('bloom-daily-report','','日報',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-daily-report','Summary','サマリ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-daily-report','Achievements','達成事項',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-daily-report','Progress','進捗グラフ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-daily-report','Next Goals','次の目標',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','','経営指標',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','summary','サマリ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','forest','売上',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','tree','架電',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','bud','経理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','全社統合','全社統合',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','ヒュアラン','ヒュアラン',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','センターライズ','センターライズ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','ARATA','ARATA',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','リンクサポート','リンクサポート',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','たいよう','たいよう',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-kpi','壱','壱',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest','','月次まとめ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest','Summary','サマリ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest','Achievements','達成リスト',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest','Progress','進捗グラフ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest','Next Goals','次月目標',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest-month','','月のまとめ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-monthly-digest-edit','','月次まとめの編集',array['admin','super_admin']::text[]),
 ('bloom-progress','','開発進捗',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-progress','overview','全体',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-progress','modules','モジュール',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-progress','history','履歴',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-roadmap','','ロードマップ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-workboard','','ワークボード',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-workboard','today','ワークボード',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-workboard','weekly','週次',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-workboard','members','メンバー別',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('bloom-workboard-ceo-status','','東海林さんの状況',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-home','','ホーム',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-dashboard','','ダッシュボード',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-mypage','','マイページ',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-call','','通話画面',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-calling-branch','','クローザー架電',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-calling-sprout','','トス架電',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-toss-wait','','クローザー待ち',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-confirm-wait','','前確・後確待ち',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-wrap-up','','業務終了報告',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-follow-call','','フォローコール',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-search','','検索',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-scripts','','スクリプト管理',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-qa','','質問と回答',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-videos','','動画',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-ranking','','有効率',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-alerts','','要フォロー',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-aporan','','アポラン',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-birthday','','誕生日',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-break-schedule','','休憩予定',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-breeze','','Breeze',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-chatwork','','Chatwork情報',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-monitoring','','モニタリング',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-feedback','','フィードバック入力',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-feedback-list','','フィードバック一覧',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]);
-- 認証済みの直接 SELECT にも適用する。管理者接続の cron・書き込み policy は変更しない。
create function public.bloom_can_read_scope(p_page text,p_tab text default '') returns boolean
language plpgsql stable security definer set search_path=public as $$
declare employee public.root_employees%rowtype; setting public.system_view_permissions%rowtype; defaults text[];
begin
 select default_roles into defaults from public.system_view_scopes where page_key=p_page and tab_key=p_tab and page_key like 'bloom-%';
 if not found then return false; end if;
 select * into employee from public.root_employees where user_id=auth.uid() and is_active=true and deleted_at is null
 and (termination_date is null or termination_date > (now() at time zone 'Asia/Tokyo')::date);
 if not found then return false; end if;
 if employee.garden_role='super_admin' then return true; end if;
 select * into setting from public.system_view_permissions where page_key=p_page and tab_key in ('',p_tab) order by (tab_key=p_tab) desc limit 1;
 if found then return employee.garden_role=any(setting.roles) or employee.employee_id=any(setting.employee_ids); end if;
 return employee.garden_role=any(defaults);
end $$;
revoke all on function public.bloom_can_read_scope(text,text) from public,anon;
grant execute on function public.bloom_can_read_scope(text,text) to authenticated;
-- root_employees は他モジュールの認証・マスタでも読むため policy を追加しない。
-- soil_call_history は Tree の書き込み先のみ。書き込みには手を加えない。
do $$
declare table_name text; read_condition text;
begin
 foreach table_name in array array['bloom_monthly_digests','bloom_roadmap_entries','bloom_module_progress','bloom_worker_status','bloom_daily_logs','root_daily_reports','root_daily_report_logs','root_module_progress'] loop
 if to_regclass('public.'||table_name) is not null then
 case table_name
 when 'bloom_monthly_digests' then read_condition := 'public.bloom_can_read_scope(''bloom-monthly-digest'',''Summary'') or public.bloom_can_read_scope(''bloom-monthly-digest'',''Achievements'') or public.bloom_can_read_scope(''bloom-monthly-digest'',''Progress'') or public.bloom_can_read_scope(''bloom-monthly-digest'',''Next Goals'') or public.bloom_can_read_scope(''bloom-monthly-digest-month'') or public.bloom_can_read_scope(''bloom-monthly-digest-edit'')';
 when 'bloom_roadmap_entries' then read_condition := 'public.bloom_can_read_scope(''bloom-roadmap'') or public.bloom_can_read_scope(''bloom-workboard'',''today'')';
 when 'bloom_module_progress' then read_condition := 'public.bloom_can_read_scope(''bloom-roadmap'')';
 when 'bloom_worker_status' then read_condition := 'public.bloom_can_read_scope(''bloom-workboard'',''today'') or public.bloom_can_read_scope(''bloom-workboard'',''members'')';
 when 'bloom_daily_logs' then read_condition := 'public.bloom_can_read_scope(''bloom-workboard'',''today'') or public.bloom_can_read_scope(''bloom-workboard'',''weekly'')';
 else read_condition := 'public.bloom_can_read_scope(''bloom-progress'',''overview'') or public.bloom_can_read_scope(''bloom-progress'',''modules'') or public.bloom_can_read_scope(''bloom-progress'',''history'')';
 end case;
 execute format('create policy bloom_view_scope_read on public.%I as restrictive for select to authenticated using (%s)',table_name,read_condition);
 end if;
 end loop;
end $$;
commit;
