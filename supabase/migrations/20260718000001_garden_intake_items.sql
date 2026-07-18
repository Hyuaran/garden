create table if not exists public.garden_intake_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('請求', '入金', '条件', '周知')),
  box_address text not null,
  message_id text not null,
  attachment_id text not null,
  file_name text not null,
  mime text not null,
  size_bytes bigint not null,
  storage_path text not null,
  mail_subject text not null,
  mail_from_name text not null,
  mail_from_address text not null,
  mail_received_at timestamptz not null,
  created_by uuid not null references auth.users(id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  status text not null default '未処理',
  unique (box_address, message_id, attachment_id)
);

alter table public.garden_intake_items enable row level security;

create policy "garden users can read intake items"
  on public.garden_intake_items for select to authenticated
  using (auth.uid() is not null);
create policy "garden users can create intake items"
  on public.garden_intake_items for insert to authenticated
  with check (created_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('garden-intake', 'garden-intake', false)
on conflict (id) do update set public = false;

create policy "garden users can read intake files"
  on storage.objects for select to authenticated
  using (bucket_id = 'garden-intake');
create policy "garden users can create intake files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'garden-intake');
create policy "garden users can remove intake files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'garden-intake');

