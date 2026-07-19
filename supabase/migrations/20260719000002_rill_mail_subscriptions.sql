create table if not exists public.rill_mail_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  box text not null,
  subscription_id text not null unique,
  expires_at timestamptz not null,
  client_state text not null,
  last_notified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, box)
);

alter table public.rill_mail_subscriptions enable row level security;

create policy "rill_mail_subscriptions_select_own"
  on public.rill_mail_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.rill_mail_subscriptions from authenticated;
grant select on public.rill_mail_subscriptions to authenticated;
