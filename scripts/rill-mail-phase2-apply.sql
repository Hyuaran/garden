begin;

alter table public.rill_mail_tokens
  add column if not exists access_token_enc text,
  add column if not exists access_token_expires_at timestamptz;

grant select, insert, update, delete on public.rill_mail_tokens to authenticated;

commit;

-- Supabase SQL Editor で適用後、PostgREST の schema cache を更新:
notify pgrst, 'reload schema';
