-- 支払漏れチェック（平日 10:00・Vercel cron）の実行記録。
-- 「前回からの新着」の起点と、失敗通知を障害ごとに 1 回にするための状態に使う。
begin;

create table if not exists public.system_mail_payment_check_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  trigger text not null,
  applied boolean not null default false,
  ok boolean not null default true,
  error text,
  counts jsonb not null default '{}'::jsonb,
  items jsonb not null default '[]'::jsonb
);

create index if not exists system_mail_payment_check_runs_ran_at_idx
  on public.system_mail_payment_check_runs (ran_at desc);

alter table public.system_mail_payment_check_runs enable row level security;

commit;
