insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leaf-kanden-photos', 'leaf-kanden-photos', false, 31457280,
        array['image/jpeg', 'image/png', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

create table if not exists public.leaf_kanden_photo_sets (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('timetree', 'form')),
  set_key text not null unique,
  timetree_event_id text,
  event_date date,
  kanri_no text,
  pdf_path text,
  photo_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaf_kanden_photos (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.leaf_kanden_photo_sets(id) on delete cascade,
  source text not null check (source in ('timetree', 'form')),
  source_key text not null unique,
  kanri_no text,
  event_date date,
  category text not null default '未分類' check (category in ('電灯', '動力', 'ガス', '諸元', '受領', '未分類')),
  width integer,
  height integer,
  bytes integer,
  image_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists leaf_kanden_photo_sets_kanri_no_idx on public.leaf_kanden_photo_sets (kanri_no);
create index if not exists leaf_kanden_photo_sets_event_date_idx on public.leaf_kanden_photo_sets (event_date);
create index if not exists leaf_kanden_photos_kanri_no_idx on public.leaf_kanden_photos (kanri_no);
create index if not exists leaf_kanden_photos_event_date_idx on public.leaf_kanden_photos (event_date);
create index if not exists leaf_kanden_photos_set_id_idx on public.leaf_kanden_photos (set_id);

alter table public.leaf_kanden_photo_sets enable row level security;
alter table public.leaf_kanden_photos enable row level security;
