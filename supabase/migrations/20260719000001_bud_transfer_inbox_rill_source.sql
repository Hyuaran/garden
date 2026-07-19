alter table public.bud_transfer_inbox
  drop constraint if exists bud_transfer_inbox_source_check;

alter table public.bud_transfer_inbox
  add constraint bud_transfer_inbox_source_check
  check (source in ('drive', 'mail', 'rill'));

comment on column public.bud_transfer_inbox.source is
  '未処理トレイへの取込元。drive=複合機/Drive, mail=Microsoft Graph mailbox, rill=Rill Mail Garden取込。';
