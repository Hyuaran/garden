create table public.system_line_broadcast_template (
 id uuid primary key default gen_random_uuid(),
 label text not null, title text not null, body text not null,
 tags jsonb not null default '[]'::jsonb,
 sort int not null default 0,
 updated_at timestamptz not null default now(),
 updated_by text, updated_by_name text
);
alter table public.system_line_broadcast_template enable row level security;
-- ポリシーなし。サーバーの管理者接続のみ使用する。
insert into public.system_line_broadcast_template (label,title,body,tags,sort) values
('雇用契約書のお知らせ','{年}年{月}月分 雇用契約書','お疲れ様です！

{年}年{月}月分【雇用契約書】のクラウドサインをお送りしてますので、認証作業をお願いします。
すでに認証済みの方もいらっしゃいますが、再送が必要な方はご連絡ください！','[{"kind": "employment", "name": "アルバイト"}, {"kind": "business", "name": "ブロードバンド事業"}, {"kind": "status", "name": "在籍中"}]'::jsonb,0),
('年末調整のお知らせ','{年}年度 年末調整申告開始のお知らせ','【年末調整申告開始のお知らせ】
～ {年}年度 ～

お疲れ様です！
年末調整の申告が開始いたしました。
すでにマネーフォワードでご登録のメールアドレスにご案内が送信されております。
※10/21(水)～10/23(金)頃

質問に「はい」もしくは「いいえ」で答えていただき、
保険料控除などの情報は入力を行って下さい。

〇令和{令和}年途中入社の従業員様の源泉徴収票について
〇控除証明や源泉徴収票について
添付いただき、原本の提出が必要です。
チームリーダーを通じて東海林まで必ずご提出ください。

〇保険料控除について
年内途中で解約された保険がある場合は、個別に東海林までご相談ください。

●申告入力・原本提出期限
令和{令和}年11月20日(金)17時
各種控除証明書が間に合わない場合は東海林までご相談ください。','[{"kind": "employment", "name": "正社員"}, {"kind": "employment", "name": "アルバイト"}, {"kind": "status", "name": "在籍中"}]'::jsonb,1);

-- 閲覧設定の歯車で保存できる対象を登録する。
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
('system-line','','公式LINE',array['super_admin']::text[]),
('system-line','tags','公式LINE：人とタグ',array['super_admin']::text[]),
('system-line','greeting','公式LINE：あいさつ文',array['super_admin']::text[]),
('system-line','broadcast','公式LINE：一斉送信',array['super_admin']::text[]),
('system-line','contacts','公式LINE：連絡先',array['super_admin']::text[]),
('system-line','richmenu','公式LINE：リッチメニュー',array['super_admin']::text[]),
('system-line','groups','公式LINE：グループ',array['super_admin']::text[]),
('system-notices','','新機能のお知らせ',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
('system-innovera','','INNOVERA番号の同期',array['staff','outsource','manager','admin','super_admin']::text[])
on conflict(page_key,tab_key) do update set label=excluded.label, default_roles=excluded.default_roles;
