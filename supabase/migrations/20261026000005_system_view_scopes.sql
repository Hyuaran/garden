-- Prepared only; do not apply to production automatically.
begin;
create table public.system_view_scopes (
 page_key text not null, tab_key text not null default '', label text not null,
 default_roles text[] not null,
 primary key(page_key,tab_key),
 check ('super_admin'=any(default_roles)),
 check (default_roles <@ array['super_admin','admin','manager','staff','cs','toss','closer','outsource']::text[])
);
alter table public.system_view_scopes enable row level security;
revoke all on public.system_view_scopes from anon,authenticated;
grant select on public.system_view_scopes to authenticated;
create policy system_view_scopes_read on public.system_view_scopes for select to authenticated using (auth.uid() is not null);
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('system-onboarding','','入社手続き',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-onboarding','self','入社手続き：自分の入社手続き',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-onboarding','candidates','入社手続き：入社予定者',array['super_admin']::text[]),
 ('system-onboarding','confirmations','入社手続き：入社後の確認',array['super_admin']::text[]),
 ('system-onboarding','all','入社手続き：みんなの入社手続き',array['manager','admin','super_admin']::text[]),
 ('system-home','','ホーム',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-docs','','資料',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-manuals','','マニュアル',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-mypage','','自分の情報',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-attendance','','勤怠打刻',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-shift','','シフト',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-zenkaku','','前確依頼',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-call-metrics','','テレマ コール集計',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-innovera-calls','','INNOVERA履歴・録音',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-forms','','業務管理ツール',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-contracts','','契約書管理',array['manager','admin','super_admin']::text[]),
 ('system-sites','','コーポレートサイト',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-deliveries','','自動配信',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('system-kanri','','管理表ポータル',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-list','','リストマスタ',array['manager','admin','super_admin']::text[]),
 ('system-forms','input','業務管理ツール：入力する',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-forms','auto','業務管理ツール：自動で動いている',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-forms','host','業務管理ツール：ホスト PC で動いている',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-forms','kintone','業務管理ツール：Kintone に入れたしかけ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-sites','sites','コーポレートサイト：サイト一覧',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-sites','news','コーポレートサイト：お知らせ',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-list','list','リストマスタ：リスト',array['manager','admin','super_admin']::text[]),
 ('system-list','upload','リストマスタ：アップロード',array['manager','admin','super_admin']::text[]),
 ('system-list','analysis','リストマスタ：分析',array['manager','admin','super_admin']::text[]),
 ('system-list','history','リストマスタ：履歴検索',array['manager','admin','super_admin']::text[]),
 ('system-list','internal-block','リストマスタ：自社アポ禁',array['manager','admin','super_admin']::text[]),
 ('system-list','guide','リストマスタ：管理方法',array['manager','admin','super_admin']::text[]),
 ('system-contracts','browse','契約書管理：契約書',array['manager','admin','super_admin']::text[]),
 ('system-contracts','register','契約書管理：登録',array['manager','admin','super_admin']::text[]),
 ('system-call-metrics','employees','テレマ コール集計：従業員ごと',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-call-metrics','lists','テレマ コール集計：リストごと',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-call-metrics','definitions','テレマ コール集計：定義方法',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-call-metrics','webinbound','テレマ コール集計：WEBインバウンド',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-kanri','kanri','管理表ポータル：管理表',array['manager','admin','super_admin']::text[]),
 ('system-kanri','jisseki','管理表ポータル：実績管理',array['manager','admin','super_admin']::text[]),
 ('system-kanri','aporan','管理表ポータル：アポラン',array['manager','admin','super_admin']::text[]),
 ('system-kanri','houhan','管理表ポータル：訪問販売',array['manager','admin','super_admin']::text[]),
 ('system-kanri','incentive','管理表ポータル：インセ計算',array['manager','admin','super_admin']::text[]),
 ('system-kanri','settings','管理表ポータル：設定',array['manager','admin','super_admin']::text[]),
 ('system-kanri','payroll','管理表ポータル：給与試算',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-manuals','operation','マニュアル：操作マニュアル',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('system-manuals','summary','マニュアル：要点',array['super_admin']::text[]),
 ('system-manuals','overview','マニュアル：仕組み',array['super_admin']::text[]),
 ('system-manuals','engineer','マニュアル：仕様',array['super_admin']::text[]),
 ('system-manuals','claude','マニュアル：Claude 用',array['super_admin']::text[]);

create or replace function public.system_view_default_roles(p_page text,p_tab text) returns text[]
language plpgsql stable set search_path=public as $$
declare result text[];
begin
 select default_roles into result from public.system_view_scopes where page_key=p_page and tab_key=p_tab;
 if not found then raise exception 'unknown scope' using errcode='22023'; end if;
 return result;
end $$;
alter table public.system_view_permissions add constraint system_view_permissions_scope_fk
 foreign key(page_key,tab_key) references public.system_view_scopes(page_key,tab_key);
revoke all on function public.system_view_default_roles(text,text) from public,anon,authenticated;
commit;
