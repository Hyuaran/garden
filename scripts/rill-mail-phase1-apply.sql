begin;

create table if not exists public.rill_mail_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ms_upn text,
  refresh_token_enc text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rill_mail_tokens enable row level security;

drop policy if exists rill_mail_tokens_select_own on public.rill_mail_tokens;
create policy rill_mail_tokens_select_own on public.rill_mail_tokens for select to authenticated using (auth.uid() = user_id);
drop policy if exists rill_mail_tokens_insert_own on public.rill_mail_tokens;
create policy rill_mail_tokens_insert_own on public.rill_mail_tokens for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists rill_mail_tokens_update_own on public.rill_mail_tokens;
create policy rill_mail_tokens_update_own on public.rill_mail_tokens for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists rill_mail_tokens_delete_own on public.rill_mail_tokens;
create policy rill_mail_tokens_delete_own on public.rill_mail_tokens for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.rill_mail_tokens to authenticated;

commit;

-- Supabase SQL Editor で適用後、必要なら PostgREST の schema cache を更新:
notify pgrst, 'reload schema';
