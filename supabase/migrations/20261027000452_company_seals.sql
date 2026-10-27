-- Private, service-role PDF generation only. No authenticated/anon object policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-seals', 'company-seals', false, 5242880, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
allowed_mime_types = excluded.allowed_mime_types;
