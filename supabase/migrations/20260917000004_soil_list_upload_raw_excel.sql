begin;

alter table public.soil_list_upload
  add column if not exists source_kind text not null default 'import_file',
  add column if not exists raw_file_names jsonb not null default '[]'::jsonb,
  add column if not exists excluded_assignment integer not null default 0,
  add column if not exists excluded_order integer not null default 0,
  add column if not exists needs_review integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'soil_list_upload_source_kind_check'
      and conrelid = 'public.soil_list_upload'::regclass
  ) then
    alter table public.soil_list_upload
      add constraint soil_list_upload_source_kind_check
      check (source_kind in ('import_file', 'raw_excel'));
  end if;
end;
$$;

comment on column public.soil_list_upload.source_kind is '取り込み元。取込ファイルか、営業の元Excelか。';
comment on column public.soil_list_upload.raw_file_names is '営業の元Excelから作った場合の元ファイル名一覧。';
comment on column public.soil_list_upload.excluded_assignment is '元Excelチェックで投入履歴にあり除外した行数。';
comment on column public.soil_list_upload.excluded_order is '元Excelチェックで受注履歴にあり除外した行数。';
comment on column public.soil_list_upload.needs_review is '元Excelチェックで確認が必要だった行数。';

commit;

