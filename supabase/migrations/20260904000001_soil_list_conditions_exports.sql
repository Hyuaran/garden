-- リストマスタ：保存した条件と書き出しの記録（Codex-291 用）
-- Supabase の SQL Editor で実行する。soil_list_* と同じく、読み書きはサーバー側（service_role）だけ。
begin;

-- 保存した絞り込み条件
create table if not exists public.soil_list_condition (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- 画面に出す名前（例：大阪 AU光可 未購入）
  condition jsonb not null,                 -- 条件（列・演算子・値の配列）
  created_by text,                          -- 作成者の表示名
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 書き出しの記録（誰が・いつ・どの条件で・何件を渡したか）
create table if not exists public.soil_list_export (
  id uuid primary key default gen_random_uuid(),
  condition jsonb not null,                 -- 書き出し時の条件
  columns text[] not null,                  -- 出した列
  row_limit integer not null,               -- 上限
  sort_key text,                            -- 並び
  row_count integer not null,               -- 実際に出した件数
  replaced_chars integer not null default 0,-- cp932 に無く「〓」に置き換えた文字数
  phone_numbers text[] not null default '{}', -- 渡した電話番号（追跡用）
  file_name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists soil_list_export_created_at_idx on public.soil_list_export (created_at desc);

alter table public.soil_list_condition enable row level security;
alter table public.soil_list_export enable row level security;
revoke all on table public.soil_list_condition, public.soil_list_export from public, anon, authenticated;
grant all on table public.soil_list_condition, public.soil_list_export to service_role;

comment on table public.soil_list_condition is 'リストマスタの保存した絞り込み条件。サーバー側のみ読み書き。';
comment on table public.soil_list_export is 'リストマスタの .mer 書き出しの記録（電話番号の配列を含む＝個人情報）。サーバー側のみ読み書き。';

commit;
