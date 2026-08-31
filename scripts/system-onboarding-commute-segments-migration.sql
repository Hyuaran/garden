begin;

create or replace function public.system_onboarding_commute_routes_valid(value jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select case when jsonb_typeof(value) <> 'array' then false else
    jsonb_array_length(value) <= 10 and not exists (
      select 1 from jsonb_array_elements(value) item where
        jsonb_typeof(item) <> 'object'
        or exists (
          select 1 from jsonb_object_keys(item) key
          where key not in ('kind', 'from_station', 'to_station', 'line', 'pass_monthly', 'fare_oneway')
        )
        or exists (
          select 1 from jsonb_each(item) field
          where jsonb_typeof(field.value) <> 'string'
        )
    ) end;
$$;

alter table public.system_onboarding
  add column if not exists commute_routes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(commute_routes) = 'array');

alter table public.system_onboarding
  drop constraint if exists system_onboarding_commute_routes_fields;

alter table public.system_onboarding
  add constraint system_onboarding_commute_routes_fields
  check (public.system_onboarding_commute_routes_valid(commute_routes));

alter table public.system_onboarding
  drop column if exists commute_station,
  drop column if exists commute_line,
  drop column if exists commute_pass_monthly,
  drop column if exists commute_fare_oneway;

comment on column public.system_onboarding.commute_routes is '入社手続きの通勤区間。最大10件、各値は文字列。';

commit;
