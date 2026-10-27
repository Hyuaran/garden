-- Tree のタブを閲覧権限の表に足す（2026-10-27・タブの決まりで モニタリング＝一覧／座席表、通話画面の引き出し＝トス／前後確 をタブにした）
begin;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('tree-monitoring','list','一覧',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-monitoring','seat','座席表',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-call','toss','トス',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
 ('tree-call','confirm','前後確',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[])
on conflict do nothing;
commit;
