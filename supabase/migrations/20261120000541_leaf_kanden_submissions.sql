begin;

create table public.leaf_kanden_submissions (
  id uuid primary key,
  set_id uuid not null unique references public.leaf_kanden_photo_sets(id),
  employee_id text not null references public.root_employees(employee_id),
  employee_number text not null,
  employee_name text not null,
  acquisition text not null check (acquisition in ('奪還','囲込')),
  kanri_no text check (kanri_no ~ '^(0|[1-9][0-9]*)$'),
  kanri_no_raw text,
  customer_name text not null,
  has_denki boolean not null,
  has_douryoku boolean not null,
  has_gas boolean not null,
  urgent_sw boolean not null,
  sw_month integer check (sw_month between 1 and 12),
  note text not null,
  specs_status text not null check (specs_status in ('あり','諸元待ち')),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (has_denki or has_douryoku or has_gas),
  check (urgent_sw = (sw_month is not null))
);
create index on public.leaf_kanden_submissions (submitted_at desc, id);
create index on public.leaf_kanden_submissions (employee_id, submitted_at desc);

create table public.leaf_kanden_settings (
  singleton boolean primary key default true check (singleton),
  image_download_password_hash text,
  updated_at timestamptz not null default now(),
  updated_by text references public.root_employees(employee_id)
);
insert into public.leaf_kanden_settings default values;

create table public.leaf_kanden_form_uploads (
  id uuid primary key,
  employee_id text not null references public.root_employees(employee_id),
  upload_month text not null,
  next_specs_index integer not null default 10001,
  locked_until timestamptz
);
create table public.leaf_kanden_download_attempts (
  employee_id text primary key references public.root_employees(employee_id),
  failures integer not null,
  last_attempt timestamptz not null
);

alter table public.leaf_kanden_submissions enable row level security;
alter table public.leaf_kanden_settings enable row level security;
alter table public.leaf_kanden_form_uploads enable row level security;
alter table public.leaf_kanden_download_attempts enable row level security;

insert into public.system_view_scopes (page_key, tab_key, label, default_roles)
values ('system-forms-kanden', '', '関電 申込の送信', array['staff','outsource','manager','admin','super_admin'])
on conflict (page_key, tab_key) do update
set label = excluded.label, default_roles = excluded.default_roles;

create function public.leaf_kanden_commit_form(
  p_submission jsonb, p_photos jsonb, p_pdf text, p_date date, p_append boolean, p_lock timestamptz
) returns void language plpgsql set search_path = public as $$
declare
  form leaf_kanden_submissions := jsonb_populate_record(null::leaf_kanden_submissions, p_submission);
  target_set uuid;
begin
  perform 1 from leaf_kanden_form_uploads
    where id = form.id and employee_id = form.employee_id and locked_until = p_lock and locked_until > now()
    for update;
  if not found then raise exception 'Invalid submission lease'; end if;

  if p_append then
    update leaf_kanden_submissions set specs_status = 'あり', updated_at = now()
      where id = form.id and employee_id = form.employee_id and specs_status = '諸元待ち'
      returning set_id into strict target_set;
  else
    insert into leaf_kanden_photo_sets (source, set_key, kanri_no, event_date)
      values ('form', 'form:' || form.id, form.kanri_no, p_date) returning id into target_set;
    form.set_id := target_set;
    form.submitted_at := now();
    form.updated_at := now();
    insert into leaf_kanden_submissions select (form).*;
  end if;

  insert into leaf_kanden_photos (set_id, source, source_key, kanri_no, event_date, category, width, height, bytes, image_path)
    select target_set, 'form', photo.path, form.kanri_no, p_date, photo.category,
      photo.width, photo.height, photo.bytes, photo.path
    from jsonb_to_recordset(p_photos) as photo(path text, category text, width int, height int, bytes int);

  update leaf_kanden_photo_sets set pdf_path = p_pdf, updated_at = now(),
    photo_count = photo_count + jsonb_array_length(p_photos) where id = target_set;
end;
$$;

-- Reserve a fresh range so cancelled or concurrent addenda never reuse an uploaded object.
create function public.leaf_kanden_reserve_specs_slots(p_id uuid, p_employee text)
returns integer language sql set search_path = public as $$
  update leaf_kanden_form_uploads as upload
    set next_specs_index = upload.next_specs_index + 10000
  where upload.id = p_id and upload.employee_id = p_employee
    and exists (
      select 1 from leaf_kanden_submissions where id = p_id and employee_id = p_employee and specs_status = '諸元待ち'
    )
  returning upload.next_specs_index - 10000;
$$;

create function public.leaf_kanden_reserve_download_attempt(p_employee text)
returns timestamptz language sql set search_path = public as $$
  insert into leaf_kanden_download_attempts as attempts (employee_id, failures, last_attempt)
    values (p_employee, 1, clock_timestamp())
  on conflict (employee_id) do update set
    failures = case when attempts.last_attempt <= clock_timestamp() - interval '10 minutes' then 1 else attempts.failures + 1 end,
    last_attempt = clock_timestamp()
    where attempts.failures < 5 or attempts.last_attempt <= clock_timestamp() - interval '10 minutes'
  returning last_attempt;
$$;

revoke execute on function public.leaf_kanden_reserve_specs_slots(uuid,text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_reserve_specs_slots(uuid,text) to service_role;
revoke execute on function public.leaf_kanden_commit_form(jsonb,jsonb,text,date,boolean,timestamptz) from public, anon, authenticated;
revoke execute on function public.leaf_kanden_reserve_download_attempt(text) from public, anon, authenticated;
grant execute on function public.leaf_kanden_commit_form(jsonb,jsonb,text,date,boolean,timestamptz) to service_role;
grant execute on function public.leaf_kanden_reserve_download_attempt(text) to service_role;

commit;
