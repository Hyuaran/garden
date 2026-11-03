begin;

alter table public.system_shift_confirmed
  add column kot_status text not null default 'unsent'
    check (kot_status in ('unsent', 'sent', 'failed', 'skipped')),
  add column kot_sent_at timestamptz,
  add column kot_error text,
  add column kot_sent_start time,
  add column kot_sent_end time;

create function public.reset_shift_kot_status() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time then
    new.kot_status := 'unsent';
    new.kot_error := null;
  end if;
  return new;
end;
$$;

create trigger reset_shift_kot_status
before update on public.system_shift_confirmed
for each row execute function public.reset_shift_kot_status();

revoke all on function public.reset_shift_kot_status() from public, anon, authenticated;
commit;
