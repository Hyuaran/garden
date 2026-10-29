-- 関西電力事業のメニューの担当（リンクは名簿の line_contact_url から読む）。事務の担当の呼び名を変更。
insert into public.system_line_contact(key,label,url) values ('kanden','関西電力事業の担当','') on conflict (key) do nothing;
update public.system_line_contact set label='事務の担当' where key='office';
