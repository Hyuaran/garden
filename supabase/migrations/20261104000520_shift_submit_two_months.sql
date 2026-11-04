-- ファイル作成のみ。適用は Claude。518 の月の検査だけを変更。
begin;

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
  if p_submit and (p_month not in (
    to_char((now() at time zone 'Asia/Tokyo') + interval '1 month','YYYY-MM'),
    to_char((now() at time zone 'Asia/Tokyo') + interval '2 months','YYYY-MM')
  )
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
      if (starts is distinct from pattern.start_time or ends is distinct from pattern.end_time or starts is null)
        and not (shift_default_weekday(d) between 1 and 5 and exists (
          select 1 from system_shift_default_option o
          where o.employee_id=p_employee and o.start_time=starts and o.end_time=ends
        )) then
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


commit;
