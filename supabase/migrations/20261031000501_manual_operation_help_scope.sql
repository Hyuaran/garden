-- Prepared only; do not apply to production automatically.
begin;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
 ('system-manuals','operation','マニュアル：使い方',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[])
on conflict(page_key,tab_key) do update set label=excluded.label, default_roles=excluded.default_roles;
commit;
