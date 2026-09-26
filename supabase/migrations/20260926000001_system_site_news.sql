create table if not exists public.system_site_news (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.root_companies(company_id),
  published_on date not null default (now() at time zone 'Asia/Tokyo')::date,
  title text not null,
  body text not null default '',
  kind text not null check (kind in ('auto','manual')),
  source_field text null check (
    source_field is null
    or source_field in ('company_name','representative','address')
  ),
  is_published boolean not null default true,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_system_site_news_company_published
  on public.system_site_news (company_id, published_on desc);

create unique index if not exists uq_system_site_news_auto_daily_source
  on public.system_site_news (company_id, published_on, source_field)
  where kind = 'auto';

create or replace function public.set_system_site_news_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_system_site_news_updated_at on public.system_site_news;
create trigger set_system_site_news_updated_at
  before update on public.system_site_news
  for each row
  execute function public.set_system_site_news_updated_at();

alter table public.system_site_news enable row level security;

drop policy if exists system_site_news_select_service_role on public.system_site_news;
create policy system_site_news_select_service_role
  on public.system_site_news
  for select
  using (auth.role() = 'service_role');

drop policy if exists system_site_news_insert_service_role on public.system_site_news;
create policy system_site_news_insert_service_role
  on public.system_site_news
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists system_site_news_update_service_role on public.system_site_news;
create policy system_site_news_update_service_role
  on public.system_site_news
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create or replace function public.upsert_system_site_news_auto(
  p_company_id text,
  p_source_field text,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  insert into public.system_site_news (
    company_id,
    published_on,
    title,
    body,
    kind,
    source_field,
    is_published,
    created_by
  )
  values (
    p_company_id,
    v_today,
    p_title,
    p_body,
    'auto',
    p_source_field,
    true,
    'system:root_companies'
  )
  on conflict (company_id, published_on, source_field)
    where kind = 'auto'
  do update set
    title = excluded.title,
    body = excluded.body,
    is_published = true,
    updated_at = now();
end;
$$;

create or replace function public.system_site_news_from_company_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.address is distinct from old.address then
    perform public.upsert_system_site_news_auto(
      new.company_id,
      'address',
      '本店移転のお知らせ',
      'このたび、' || coalesce(new.company_name, '') || 'は下記へ本店を移転いたしました。' || E'\n'
        || '新所在地：' || coalesce(new.address, '') || E'\n'
        || '電話番号：' || coalesce(new.phone, '') || E'\n'
        || '今後ともよろしくお願い申し上げます。'
    );
  end if;

  if new.representative is distinct from old.representative then
    perform public.upsert_system_site_news_auto(
      new.company_id,
      'representative',
      '代表取締役変更のお知らせ',
      'このたび、' || coalesce(new.company_name, '') || 'は代表取締役が'
        || coalesce(new.representative, '') || 'に就任いたしました。' || E'\n'
        || '今後ともよろしくお願い申し上げます。'
    );
  end if;

  if new.company_name is distinct from old.company_name then
    perform public.upsert_system_site_news_auto(
      new.company_id,
      'company_name',
      '社名変更のお知らせ',
      'このたび、' || coalesce(old.company_name, '') || 'は'
        || coalesce(new.company_name, '') || 'に社名を変更いたしました。' || E'\n'
        || '今後ともよろしくお願い申し上げます。'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists system_site_news_from_company_change on public.root_companies;
create trigger system_site_news_from_company_change
  after update on public.root_companies
  for each row
  execute function public.system_site_news_from_company_change();
