begin;
alter table public.system_hire_candidates
 add column line_display_renamed_at timestamptz,
 add column line_display_renamed_by uuid;
update public.system_hire_candidates
 set line_display_renamed_at = line_verified_at
 where line_verified_at is not null;
commit;
