-- 表示名のみ更新。本番への適用は人間側で行う。
begin;
update public.system_view_scopes
set label = 'KING OF TIME 同期履歴'
where page_key = 'root-kot-sync-history' and tab_key = '' and label = 'KOT 同期履歴';
commit;
