-- マニュアル資料：画面からの差し替え履歴を記録する。
-- migration は書くだけ。実行は別担当で行う。
begin;

create table if not exists public.system_manual_versions (
  id uuid primary key default gen_random_uuid(),
  module text not null,
  slug text not null,
  file text not null,
  storage_path text not null,
  size bigint,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  note text
);

create index if not exists system_manual_versions_lookup_idx
  on public.system_manual_versions (module, slug, file, uploaded_at desc);

alter table public.system_manual_versions enable row level security;

revoke all on table public.system_manual_versions from public, anon, authenticated;
grant all on table public.system_manual_versions to service_role;

comment on table public.system_manual_versions is 'System マニュアル資料の差し替え履歴。Storage の現在版と _versions 退避版のパスを記録する。';
comment on column public.system_manual_versions.module is 'manuals-registry の moduleSlug。';
comment on column public.system_manual_versions.slug is 'manuals-registry の slug。';
comment on column public.system_manual_versions.file is 'manuals-registry の登録ファイル名。';
comment on column public.system_manual_versions.storage_path is 'system-manuals バケット内の保存パス。現在版または _versions 配下。';
comment on column public.system_manual_versions.size is 'ファイルサイズ（バイト）。';
comment on column public.system_manual_versions.uploaded_by is '画面表示用の更新者名。';
comment on column public.system_manual_versions.note is 'いま表示中、差し替え前の版、復元前の版などの補足。';

commit;
