begin;
alter table public.system_hire_candidates
 alter column first_name drop not null,
 alter column first_name_kana drop not null,
 alter column birthday drop not null,
 alter column gender drop not null;
alter table public.system_hire_candidates add constraint hire_non_haken_identity_required check (
 employment_type = '派遣' or (
  nullif(btrim(first_name),'') is not null and nullif(btrim(first_name_kana),'') is not null
  and birthday is not null and gender is not null
 ));
commit;
