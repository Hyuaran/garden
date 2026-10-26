-- 作成のみ。本番への適用は人間側で行う。
begin;
insert into public.system_view_scopes(page_key, tab_key, label, default_roles) values
 ('root-home','','ホーム',array['manager','admin','super_admin']::text[]),
 ('root-employees','','従業員マスタ',array['manager','admin','super_admin']::text[]),
 ('root-companies','','法人マスタ',array['manager','admin','super_admin']::text[]),
 ('root-vendors','','取引先',array['manager','admin','super_admin']::text[]),
 ('root-bank-accounts','','銀行口座',array['manager','admin','super_admin']::text[]),
 ('root-bank-check','','口座の点検',array['admin','super_admin']::text[]),
 ('root-salary-systems','','給与体系',array['manager','admin','super_admin']::text[]),
 ('root-insurance','','社会保険',array['manager','admin','super_admin']::text[]),
 ('root-attendance','','勤怠データ',array['manager','admin','super_admin']::text[]),
 ('root-kot-sync-history','','KOT 同期履歴',array['admin','super_admin']::text[]),
 ('root-contracts','','契約書',array['manager','admin','super_admin']::text[]),
 ('root-inbox','','受信箱',array['manager','admin','super_admin']::text[]),
 ('root-permissions','','権限一覧',array['manager','admin','super_admin']::text[]);
-- 既存 RPC は system_view_default_roles と外部キーで登録済み scope のみ受け付ける。
-- 書き込み用の RLS・ROOT_WRITE_ROLES・操作用 RPC は変更しない。
commit;
