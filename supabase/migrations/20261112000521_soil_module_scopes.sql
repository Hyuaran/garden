-- Codex-521: ファイル作成のみ。適用は Claude が行う。定期取得の追加は 0 回/日。
begin;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('soil-product-points','','付与ポイント表',array['manager','admin','super_admin']::text[])
on conflict (page_key,tab_key) do nothing;

-- 旧設定を残したまま、新キーが未設定の場合だけ役職・個人設定を複写する。
insert into public.system_view_permissions
 (page_key,tab_key,roles,employee_ids,viewers_can_add,updated_by,updated_at)
select 'soil-product-points',tab_key,roles,employee_ids,false,updated_by,updated_at
from public.system_view_permissions
where page_key='system-product-points' and tab_key=''
on conflict (page_key,tab_key) do nothing;
commit;
