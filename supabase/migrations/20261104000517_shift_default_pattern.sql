-- ファイル作成のみ。適用は Claude。既存の備考付き save_shift_person を引き継ぐ。
begin;

alter table public.system_shift_submitter drop constraint system_shift_submitter_mode_check;
alter table public.system_shift_submitter add check (mode in ('include', 'exclude', 'default'));

create table public.system_shift_default (
  employee_id text not null references public.root_employees(employee_id),
  weekday integer not null check (weekday in (0,1,2,3,4,5,6,8)),
  start_time time,
  end_time time,
  updated_at timestamptz not null default now(),
  updated_by text references public.root_employees(employee_id),
  primary key (employee_id, weekday),
  check ((start_time is null and end_time is null) or
    (start_time is not null and end_time is not null and start_time >= time '06:00'
     and end_time > start_time and extract(minute from start_time) in (0,30)
     and extract(minute from end_time) in (0,30)
     and extract(second from start_time)=0 and extract(second from end_time)=0))
);
alter table public.system_shift_default enable row level security;
revoke all on public.system_shift_default from public, anon, authenticated;
grant all on public.system_shift_default to service_role;

alter table public.system_shift_wish drop constraint system_shift_wish_start_time_check;
alter table public.system_shift_confirmed drop constraint system_shift_confirmed_check;
alter table public.system_shift_wish add column end_time time;
alter table public.system_shift_wish add column day_kind text;
alter table public.system_shift_confirmed add column day_kind text;
alter table public.system_shift_confirmed
  add column kot_manual_at timestamptz,
  add column kot_manual_by text references public.root_employees(employee_id);
update public.system_shift_wish
set end_time=case when start_time is null then null else time '21:00' end,
    day_kind=case when start_time is null then 'rest' else 'work' end;
update public.system_shift_confirmed
set day_kind=case when start_time is null then 'rest' else 'work' end;

-- 古い取込処理の start_time だけの INSERT も維持する。
create function public.normalize_shift_day() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.day_kind is null then
    new.day_kind := case when new.start_time is null then 'rest' else 'work' end;
    if new.start_time is not null and new.end_time is null then new.end_time := time '21:00'; end if;
  end if;
  return new;
end $$;
create trigger normalize_shift_day before insert or update on public.system_shift_wish
for each row execute function public.normalize_shift_day();
create trigger normalize_shift_day before insert or update on public.system_shift_confirmed
for each row execute function public.normalize_shift_day();

alter table public.system_shift_wish alter column day_kind set not null;
alter table public.system_shift_confirmed alter column day_kind set not null;
alter table public.system_shift_wish add constraint system_shift_wish_day_check check (
  (day_kind in ('rest','paid') and start_time is null and end_time is null) or
  (day_kind='work' and start_time is not null and end_time is not null
   and start_time >= time '06:00' and end_time > start_time
   and extract(minute from start_time) in (0,30) and extract(minute from end_time) in (0,30)
   and extract(second from start_time)=0 and extract(second from end_time)=0));
alter table public.system_shift_confirmed add constraint system_shift_confirmed_day_check check (
  (day_kind in ('rest','paid') and start_time is null and end_time is null) or
  (day_kind='work' and start_time is not null and end_time is not null
   and start_time >= time '06:00' and end_time > start_time
   and extract(minute from start_time) in (0,30) and extract(minute from end_time) in (0,30)
   and extract(second from start_time)=0 and extract(second from end_time)=0));

create function public.shift_person_mode(p_employee text) returns text
language sql stable set search_path=public as $$
  select case
    when e.is_active is distinct from true or e.deleted_at is not null
      or e.termination_date <= (now() at time zone 'Asia/Tokyo')::date then null
    when s.mode='exclude' then null
    when s.mode='default' then 'default'
    when s.mode='include' then 'telema'
    when e.employment_type='アルバイト' and e.business='ブロードバンド事業'
      and coalesce(e.current_team,'') not in ('','バックヤード','所属なし') then 'telema'
    when e.employment_type in ('正社員','契約社員','パート','アルバイト') then 'default'
    else null end
  from root_employees_with_team e
  left join system_shift_submitter s using(employee_id)
  where e.employee_id=p_employee
$$;

-- 祝日は既存の jp-holidays.ts と同じ日付。次年の追加時は両方更新する。
create function public.shift_default_weekday(p_date date) returns integer
language sql immutable as $$
  select case when p_date = any(array[
    '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29',
    '2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11',
    '2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
    '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22',
    '2027-04-29','2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11',
    '2027-09-20','2027-09-23','2027-10-11','2027-11-03','2027-11-23'
  ]::date[]) then 8 else extract(dow from p_date)::integer end
$$;

create or replace function public.save_shift_person(
  p_employee text, p_month text, p_rows jsonb, p_actor text,
  p_submit boolean, p_note text default ''
) returns void language plpgsql set search_path=public as $$
declare
  target_confirmed boolean;
  mode text;
  r jsonb;
  d date;
  starts time;
  ends time;
  kind text;
  closed boolean;
  pattern system_shift_default%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
  mode := shift_person_mode(p_employee);
  if mode is null then raise exception 'シフトの提出はありません。'; end if;
  if mode='default' and p_month<'2026-12' then raise exception '2026年12月分から提出します。'; end if;
  if p_submit and (p_month <> to_char((now() at time zone 'Asia/Tokyo') + interval '1 month','YYYY-MM')
    or now() >= (((p_month||'-01')::date - interval '1 month' + interval '15 days') at time zone 'Asia/Tokyo')) then
    raise exception '提出の締切を過ぎました。変更は責任者に連絡してください。';
  end if;
  select exists(select 1 from system_shift_month where year_month=p_month and confirmed_at is not null) into target_confirmed;
  if p_submit and target_confirmed then
    raise exception '確定後のシフトは変更できません。責任者に連絡してください。';
  end if;
  if char_length(p_note)>500 then raise exception '備考は500字までで入力してください。'; end if;
  if mode='default' and p_submit and (select count(*) from system_shift_default where employee_id=p_employee)<>8 then
    raise exception '既定の勤務を準備しています。';
  end if;
  if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows) <>
    extract(day from ((p_month||'-01')::date+interval '1 month - 1 day')) then
    raise exception 'すべての日のシフトを入力してください。';
  end if;
  if (select count(distinct value->>'work_date') from jsonb_array_elements(p_rows))<>jsonb_array_length(p_rows) then
    raise exception '日付を確認してください。';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    d := (r->>'work_date')::date;
    if to_char(d,'YYYY-MM')<>p_month then raise exception '日付を確認してください。'; end if;
    starts := (r->>'start_time')::time;
    ends := case when starts is null then null else coalesce((r->>'end_time')::time,time '21:00') end;
    kind := coalesce(r->>'day_kind',case when starts is null then 'rest' else 'work' end);
    if mode='default' and p_submit and kind='work' then
      select * into pattern from system_shift_default
      where employee_id=p_employee and weekday=shift_default_weekday(d);
      if starts is distinct from pattern.start_time or ends is distinct from pattern.end_time or starts is null then
        raise exception 'その日の既定の勤務・休み・有給から選んでください。';
      end if;
    end if;
    closed := mode='telema' and exists(select 1 from system_kanri_month_setting where year_month=p_month and d=any(holidays));
    if target_confirmed and not p_submit then
      if closed then starts:=null; ends:=null; kind:='rest'; end if;
      insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,day_kind,updated_by)
      values(p_employee,d,starts,ends,kind,p_actor)
      on conflict(employee_id,work_date) do update set
        start_time=excluded.start_time,end_time=excluded.end_time,day_kind=excluded.day_kind,
        updated_at=now(),updated_by=p_actor;
    else
      insert into system_shift_wish(employee_id,work_date,start_time,end_time,day_kind,updated_by)
      values(p_employee,d,starts,ends,kind,p_actor)
      on conflict(employee_id,work_date) do update set
        start_time=excluded.start_time,end_time=excluded.end_time,day_kind=excluded.day_kind,
        updated_at=now(),updated_by=p_actor;
    end if;
  end loop;
  if p_submit then
    insert into system_shift_submission(employee_id,year_month,updated_by,note)
    values(p_employee,p_month,p_actor,p_note)
    on conflict(employee_id,year_month) do update set
      submitted_at=now(),updated_at=now(),updated_by=p_actor,note=p_note;
  end if;
end $$;

create or replace function public.confirm_shift_month(p_month text,p_people text[],p_actor text,p_name text)
returns void language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
  if exists(select 1 from unnest(p_people) e where shift_person_mode(e)='default' and
    (p_month<'2026-12' or (select count(*) from system_shift_default where employee_id=e)<>8)) then
    raise exception '既定の勤務が未設定の人がいます。設定してから確定してください。';
  end if;
  delete from system_shift_confirmed where to_char(work_date,'YYYY-MM')=p_month;
  insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,day_kind,updated_by)
  select e,d::date,
    case when c.closed then null when w.employee_id is not null then w.start_time else p.start_time end,
    case when c.closed then null when w.employee_id is not null then w.end_time else p.end_time end,
    case when c.closed then 'rest' when w.employee_id is not null then w.day_kind
      when p.start_time is not null then 'work' else 'rest' end,p_actor
  from unnest(p_people) e
  cross join generate_series((p_month||'-01')::date,((p_month||'-01')::date+interval '1 month - 1 day')::date,interval '1 day') d
  left join system_shift_wish w on w.employee_id=e and w.work_date=d::date
  left join system_shift_default p on p.employee_id=e and p.weekday=shift_default_weekday(d::date) and shift_person_mode(e)='default'
  left join system_kanri_month_setting s on s.year_month=p_month
  cross join lateral (select shift_person_mode(e)='telema' and d::date=any(coalesce(s.holidays,'{}'::date[])) as closed) c;
  insert into system_shift_month values(p_month,now(),p_actor,p_name)
  on conflict(year_month) do update set confirmed_at=now(),confirmed_by=p_actor,confirmed_by_name=p_name;
end $$;

create or replace function public.apply_shift_holidays() returns trigger
language plpgsql set search_path=public as $$
begin
  lock table system_shift_confirmed in share row exclusive mode;
  update system_shift_confirmed set start_time=null,end_time=null,day_kind='rest',updated_at=now(),
    updated_by=(select employee_id from root_employees where user_id=new.updated_by limit 1)
  where to_char(work_date,'YYYY-MM')=new.year_month and work_date=any(new.holidays)
    and start_time is not null and shift_person_mode(employee_id)='telema';
  return new;
end $$;

create or replace function public.reset_shift_kot_status() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time
     or new.day_kind is distinct from old.day_kind then
    new.kot_status := 'unsent';
    new.kot_error := null;
    new.kot_manual_at := null;
    new.kot_manual_by := null;
  end if;
  return new;
end $$;

revoke all on function public.normalize_shift_day(), public.shift_person_mode(text),
  public.shift_default_weekday(date) from public, anon, authenticated;
grant execute on function public.normalize_shift_day(), public.shift_person_mode(text),
  public.shift_default_weekday(date) to service_role;
-- 置換した既存関数の service_role のみの権限は維持される。
commit;
