create table if not exists public.toss_partners (
  partner_code text primary key
    constraint toss_partners_partner_code_format check (partner_code ~ '^[0-9]{7}$'),
  partner_name text not null,
  user_id uuid unique references auth.users(id),
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.toss_partners enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'toss_partners'
      and policyname = 'toss partners can read own profile'
  ) then
    create policy "toss partners can read own profile"
      on public.toss_partners
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;
end
$$;

create or replace function public.toss_partners_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_toss_partners_updated_at on public.toss_partners;
create trigger trg_toss_partners_updated_at
before update on public.toss_partners
for each row execute function public.toss_partners_set_updated_at();

