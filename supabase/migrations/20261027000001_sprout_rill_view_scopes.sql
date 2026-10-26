-- Codex-445: 作成のみ。本番 DB には適用しない。
begin;
-- 応募者の個人情報と個人受信箱では、閲覧者による人の追加を許可しない。
alter table public.system_view_permissions add constraint sprout_rill_viewers_cannot_add
 check ((page_key not like 'sprout-%' and page_key not like 'rill-%') or viewers_can_add=false);

insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('sprout-applicants','','採用管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('sprout-applicants','applicants','応募者',array['super_admin']::text[]),
 ('sprout-applicants','interviews','面接予定',array['super_admin']::text[]),
 ('sprout-applicants','training','研修予定',array['super_admin']::text[]),
 ('sprout-postings','','掲載管理',array['staff','outsource','manager','admin','super_admin']::text[]),
 ('sprout-postings','baitoru','バイトル',array['super_admin']::text[]),
 ('rill-mail','','メッセージ',array['admin','super_admin']::text[]),
 ('rill-mail','all','すべての箱',array['admin','super_admin']::text[]),
 ('rill-mail','flagged','ピン止め',array['admin','super_admin']::text[]),
 ('rill-mail','me','自分の受信箱',array['admin','super_admin']::text[]),
 ('rill-mail','sent','送信済み',array['admin','super_admin']::text[]),
 ('rill-mail','shared','共有受信箱',array['admin','super_admin']::text[]);

-- Sprout の入口（staff 以上の準備中画面）と実データ（全権管理者のみ）の
-- 従来の違いを残す。ページ設定があればタブへ継承し、タブ設定を優先する。
-- 読み取りはサーバー側の canView 判定後に既存の管理者接続で行う。
-- Rill はユーザー本人の Microsoft token / RLS を引き続き使う。
-- 書き込み用の policy / RPC / 外部取り込み口は変更しない。
commit;
