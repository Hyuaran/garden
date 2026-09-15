-- リストマスタ：自社アポ禁履歴と履歴検索用の台帳印を追加する。
-- migration は書くだけ。実行は Claude が行う。
begin;

create table if not exists public.soil_list_internal_block (
  id uuid primary key default gen_random_uuid(),
  "電話番号" text not null,
  "登録日" date not null default current_date,
  "理由" text not null,
  "登録者" text not null default '',
  "出所" text not null,
  "解除日" date,
  "解除者" text,
  "解除理由" text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint soil_list_internal_block_phone_digits_check check ("電話番号" ~ '^[0-9]+$'),
  constraint soil_list_internal_block_source_check check ("出所" = '画面' or "出所" like 'ファイル:%'),
  constraint soil_list_internal_block_reason_check check (length(btrim("理由")) > 0)
);

alter table public.soil_list_internal_block enable row level security;

create index if not exists soil_list_internal_block_phone_idx
  on public.soil_list_internal_block ("電話番号");

create index if not exists soil_list_internal_block_active_phone_idx
  on public.soil_list_internal_block ("電話番号")
  where "解除日" is null;

create index if not exists soil_list_internal_block_registered_on_idx
  on public.soil_list_internal_block ("登録日" desc, created_at desc);

alter table public.soil_list_phone
  add column if not exists "自社アポ禁" boolean not null default false;

create index if not exists soil_list_phone_internal_block_idx
  on public.soil_list_phone ("自社アポ禁");

alter table public.soil_list_export
  add column if not exists excluded_internal_block integer not null default 0;

create or replace function public.soil_list_internal_block_active(p_phone text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.soil_list_internal_block b
    where b."電話番号" = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
      and b."解除日" is null
  );
$$;

create or replace function public.soil_list_phone_set_internal_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new."自社アポ禁" := public.soil_list_internal_block_active(new."電話番号");
  return new;
end;
$$;

drop trigger if exists soil_list_phone_set_internal_block_trg on public.soil_list_phone;
create trigger soil_list_phone_set_internal_block_trg
before insert or update of "電話番号" on public.soil_list_phone
for each row
execute function public.soil_list_phone_set_internal_block();

revoke all on table public.soil_list_internal_block from public, anon, authenticated;
grant all on table public.soil_list_internal_block to service_role;

revoke all on function public.soil_list_internal_block_active(text) from public, anon, authenticated;
revoke all on function public.soil_list_phone_set_internal_block() from public, anon, authenticated;
grant execute on function public.soil_list_internal_block_active(text) to service_role;
grant execute on function public.soil_list_phone_set_internal_block() to service_role;

comment on table public.soil_list_internal_block is '自社アポ禁履歴。ヒュアラン社内だけの架電禁止を、購入元のアポ禁とは別に持つ。';
comment on column public.soil_list_phone."自社アポ禁" is '未解除の自社アポ禁履歴がある番号。AU光架電可否や購入元のアポ禁は変えない。';
comment on column public.soil_list_export.excluded_internal_block is '書き出し時に条件と独立して除外した自社アポ禁の件数。';
comment on function public.soil_list_internal_block_active(text) is '電話番号に未解除の自社アポ禁履歴があるかを返す。';
comment on function public.soil_list_phone_set_internal_block() is '電話番号台帳の insert/update 時に自社アポ禁の印を履歴から同期する。';

commit;
