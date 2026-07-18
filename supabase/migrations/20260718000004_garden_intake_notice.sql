alter table public.garden_intake_items
  add column if not exists notice_text text;

comment on column public.garden_intake_items.notice_text is
  'User-reviewed LINE notice draft generated from a 周知 intake attachment.';

create policy "garden users can update own intake notice images"
  on storage.objects for update to authenticated
  using (bucket_id = 'garden-intake' and owner_id = auth.uid()::text)
  with check (bucket_id = 'garden-intake' and owner_id = auth.uid()::text);
