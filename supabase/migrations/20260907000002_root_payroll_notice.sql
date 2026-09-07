-- 給与計算連絡（営業部のリーダーが月次で送る連絡。Root に貯め、本人の Chatwork アカウントで【確認】チーム給与計算 ルームへ送る）
-- 実行は Claude が DB 直結で行う（東海林さんの SQL OK のあと）。冪等。
begin;

-- 1) 本人の Chatwork API トークン（暗号化して保存。登録・更新・削除は本人だけ。読むのはサーバー（service_role）だけ）
alter table public.root_employees
  add column if not exists chatwork_api_token_enc text,
  add column if not exists chatwork_account_name text,      -- 接続確認で取れた Chatwork の表示名
  add column if not exists chatwork_token_updated_at timestamptz;
comment on column public.root_employees.chatwork_api_token_enc is '本人の Chatwork API トークン（RILL_TOKEN_ENC_KEY で暗号化）。給与計算連絡などを本人名義で送るために使う';

-- 2) 給与計算連絡の記録
create table if not exists public.root_payroll_notice (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id),
  submitter_name text not null,
  team text not null,                              -- 宮永チーム / 小泉チーム / 石原チーム
  commute_flag text not null,                      -- いる / いない
  commute_people jsonb not null default '[]'::jsonb,   -- [{name, station}]
  training_flag text not null,
  training_people jsonb not null default '[]'::jsonb,  -- [{name}]
  referral_flag text not null,
  referral_people jsonb not null default '[]'::jsonb,  -- [{name, referrer}]
  other_notes text not null,
  chatwork_message text not null,                  -- 実際に送った本文（全文）
  chatwork_room_id text,
  chatwork_sent_at timestamptz,
  chatwork_message_id text,
  chatwork_error text
);
create index if not exists idx_root_payroll_notice_submitted on public.root_payroll_notice(submitted_at desc);

alter table public.root_payroll_notice enable row level security;
-- 閲覧は責任者以上。書き込みはサーバー（service_role）だけ
drop policy if exists root_payroll_notice_select_manager on public.root_payroll_notice;
create policy root_payroll_notice_select_manager on public.root_payroll_notice
  for select to authenticated using (public.has_role_at_least('manager'));

comment on table public.root_payroll_notice is '給与計算に関する連絡（営業部のリーダー → 【確認】チーム給与計算 ルーム）。項目は 2026-09 の Google フォーム版と同じ';

commit;
