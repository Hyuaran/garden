-- Codex-515。適用はClaude。追加の定期実行は1日0回。
begin;
create table public.system_attendance_settings (
  id boolean primary key default true check (id),
  kot_send_start_date date,
  updated_at timestamptz not null default now(),
  updated_by text references public.root_employees(employee_id)
);
insert into public.system_attendance_settings(id) values (true);
create table public.system_attendance_kot_send (
  employee_id text references public.root_employees(employee_id),
  work_date date not null,
  status text not null check (status in ('sent','failed','unknown','manual')),
  rows jsonb not null default '[]',
  error text,
  sent_at timestamptz,
  sent_by text references public.root_employees(employee_id),
  updated_at timestamptz not null default now(),
  primary key(employee_id,work_date)
);
create table public.system_attendance_corrections (
  id bigint generated always as identity primary key,
  employee_id text not null references public.root_employees(employee_id),
  work_date date not null,
  action text not null check (action in ('add','change','delete')),
  punch_type text not null check (punch_type in ('clock_in','clock_out','break_start','break_end')),
  target_punch_id bigint,
  requested_time timestamptz,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'pending' check (status in ('pending','approved','rejected','canceled')),
  decided_by text references public.root_employees(employee_id),
  decided_at timestamptz,
  decided_comment text,
  kot_fix_needed boolean not null default false,
  kot_fixed_at timestamptz,
  kot_fixed_by text references public.root_employees(employee_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((action = 'add' and target_punch_id is null and requested_time is not null)
    or (action = 'change' and target_punch_id is not null and requested_time is not null)
    or (action = 'delete' and target_punch_id is not null and requested_time is null))
);
alter table public.system_attendance_settings enable row level security;
alter table public.system_attendance_kot_send enable row level security;
alter table public.system_attendance_corrections enable row level security;
alter table public.system_attendance_punches
  add column voided_at timestamptz,
  add column voided_by_correction_id bigint references public.system_attendance_corrections(id),
  add column correction_id bigint references public.system_attendance_corrections(id),
  add column device_type text check (device_type in ('pc','smartphone'));
create index attendance_correction_pending on public.system_attendance_corrections(employee_id,work_date) where status='pending';
create index attendance_active_punch_day on public.system_attendance_punches(employee_id,punched_at) where voided_at is null;

-- 全ての変更と送信の取得は同じ人×日のロックで直列化する。
create function public.decide_attendance_correction(
  p_id bigint, p_actor text, p_decision text, p_comment text, p_super boolean default false
) returns void language plpgsql set search_path=public as $$
declare
  c system_attendance_corrections;
  original system_attendance_punches;
  needs_fix boolean;
begin
  select * into strict c from system_attendance_corrections where id=p_id;
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||c.employee_id||':'||c.work_date,0));
  select * into strict c from system_attendance_corrections where id=p_id for update;
  if c.status <> 'pending' then raise exception 'この申請は処理済みです。'; end if;
  if p_decision='canceled' then
    if c.employee_id<>p_actor then raise exception '自分の申請だけ取り消せます。'; end if;
  elsif p_decision in ('approved','rejected') then
    if c.employee_id=p_actor and not p_super then raise exception '自分の申請は承認できません。'; end if;
    if p_decision='rejected' and length(trim(coalesce(p_comment,'')))=0 then raise exception '却下の理由を入力してください。'; end if;
  else raise exception '操作を確認してください。'; end if;
  if exists(select 1 from system_attendance_punches where employee_id=c.employee_id
    and (punched_at at time zone 'Asia/Tokyo')::date=c.work_date and kot_sync_status='sending' and voided_at is null) then
    raise exception '送信の処理中です。完了後にもう一度押してください。';
  end if;
  needs_fix := false;
  if p_decision='approved' then
    needs_fix := exists(select 1 from system_attendance_kot_send where employee_id=c.employee_id and work_date=c.work_date and status in ('sent','manual','unknown'))
      or exists(select 1 from system_attendance_punches where employee_id=c.employee_id
        and (punched_at at time zone 'Asia/Tokyo')::date=c.work_date and kot_sync_status='synced' and voided_at is null)
      or now() >= ((c.work_date+2)::timestamp at time zone 'Asia/Tokyo');
    if c.action in ('change','delete') then
      select * into strict original from system_attendance_punches where id=c.target_punch_id for update;
      if original.employee_id<>c.employee_id or original.voided_at is not null or
        (original.punched_at at time zone 'Asia/Tokyo')::date<>c.work_date then raise exception '対象の打刻が変わりました。'; end if;
      update system_attendance_punches set voided_at=now(),voided_by_correction_id=c.id where id=original.id;
    end if;
    if c.action in ('add','change') then
      if (c.requested_time at time zone 'Asia/Tokyo')::date<>c.work_date then raise exception '日付を確認してください。'; end if;
      insert into system_attendance_punches(employee_id,punch_type,punched_at,client_punch_id,source,correction_id,kot_sync_status)
      values(c.employee_id,c.punch_type,c.requested_time,gen_random_uuid()::text,'correction',c.id,case when needs_fix then 'synced' else 'unsent' end);
    end if;
  end if;
  update system_attendance_corrections set status=p_decision,decided_by=p_actor,decided_at=now(),
    decided_comment=p_comment,kot_fix_needed=needs_fix,updated_at=now() where id=c.id;
end $$;

-- 取得処理の人×日単位の置換。web/correctionは削除しない。
create function public.import_kot_attendance_day(
  p_employee text, p_date date, p_punches jsonb, p_shift jsonb default null
) returns void language plpgsql set search_path=public as $$
declare start_date date;
begin
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||p_employee||':'||p_date,0));
  select kot_send_start_date into start_date from system_attendance_settings where id=true for share;
  if start_date is not null and p_date>=start_date then raise exception '開始日以降は取得できません。'; end if;
  delete from system_attendance_punches where employee_id=p_employee and source='kot_import'
    and (punched_at at time zone 'Asia/Tokyo')::date=p_date;
  insert into system_attendance_punches(employee_id,punch_type,punched_at,client_punch_id,source,kot_punched_at,kot_sync_status,kot_synced_at,device_type)
  select p_employee,r->>'punch_type',(r->>'punched_at')::timestamptz,r->>'client_punch_id','kot_import',
    (r->>'punched_at')::timestamptz,'synced',now(),null from jsonb_array_elements(p_punches) r;
  if jsonb_array_length(p_punches)>0 then
    insert into system_attendance_kot_send(employee_id,work_date,status,rows,sent_at)
    values(p_employee,p_date,'sent',p_punches,now())
    on conflict(employee_id,work_date) do update set status='sent',rows=excluded.rows,sent_at=now(),error=null,updated_at=now();
  else
    delete from system_attendance_kot_send where employee_id=p_employee and work_date=p_date and sent_by is null;
  end if;
  if p_shift is not null then
    perform pg_advisory_xact_lock(hashtext('shift:'||to_char(p_date,'YYYY-MM')));
    delete from system_shift_wish where employee_id=p_employee and work_date=p_date;
    delete from system_shift_confirmed where employee_id=p_employee and work_date=p_date;
    insert into system_shift_wish(employee_id,work_date,start_time) values(p_employee,p_date,(p_shift->>'start_time')::time);
    insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,kot_status,kot_sent_at,kot_sent_start,kot_sent_end)
    values(p_employee,p_date,(p_shift->>'start_time')::time,
      case when p_shift->>'start_time' is null then null else time '21:00' end,
      p_shift->>'kot_status',now(),(p_shift->>'start_time')::time,
      case when p_shift->>'start_time' is null then null else time '21:00' end);
    insert into system_shift_month(year_month,confirmed_at,confirmed_by_name)
    values(to_char(p_date,'YYYY-MM'),now(),'KING OF TIME から取得')
    on conflict(year_month) do update set confirmed_at=now(),confirmed_by_name=excluded.confirmed_by_name;
  end if;
end $$;

alter table public.system_shift_wish drop constraint system_shift_wish_start_time_check;
alter table public.system_shift_wish add check(start_time is null or
  (start_time between time '10:00' and time '20:30' and extract(minute from start_time) in (0,30) and extract(second from start_time)=0));
alter table public.system_shift_confirmed drop constraint system_shift_confirmed_check;
alter table public.system_shift_confirmed add check((start_time is null and end_time is null) or
  (start_time is not null and end_time is not null and end_time=time '21:00' and start_time between time '10:00' and time '20:30'
  and extract(minute from start_time) in (0,30) and extract(second from start_time)=0));
alter table public.system_shift_submission add column note text check(char_length(note)<=500);

drop function public.save_shift_person(text,text,jsonb,text,boolean);
create function public.save_shift_person(p_employee text,p_month text,p_rows jsonb,p_actor text,p_submit boolean,p_note text default '') returns void language plpgsql set search_path=public as $$
declare target_confirmed boolean;
begin
 perform pg_advisory_xact_lock(hashtext('shift:'||p_month));
 if p_submit and (p_month <> to_char((now() at time zone 'Asia/Tokyo') + interval '1 month','YYYY-MM') or now() >= (((p_month||'-01')::date - interval '1 month' + interval '15 days') at time zone 'Asia/Tokyo')) then
  raise exception '提出の締切を過ぎました。変更は責任者に連絡してください。';
 end if;
 select exists(select 1 from system_shift_month where year_month=p_month and confirmed_at is not null) into target_confirmed;
 if p_submit and target_confirmed then raise exception '確定後のシフトは変更できません。責任者に連絡してください。'; end if;
 if target_confirmed and not p_submit then
 insert into system_shift_confirmed(employee_id,work_date,start_time,end_time,updated_by)
 select p_employee,(r->>'work_date')::date,case when (r->>'work_date') in (select jsonb_array_elements_text(to_jsonb(holidays)) from system_kanri_month_setting where year_month=p_month) then null else (r->>'start_time')::time end,
 case when r->>'start_time' is null or (r->>'work_date') in (select jsonb_array_elements_text(to_jsonb(holidays)) from system_kanri_month_setting where year_month=p_month) then null else time '21:00' end,p_actor from jsonb_array_elements(p_rows) r
 on conflict(employee_id,work_date) do update set start_time=excluded.start_time,end_time=excluded.end_time,updated_at=now(),updated_by=p_actor;
 else
 insert into system_shift_wish(employee_id,work_date,start_time,updated_by) select p_employee,(r->>'work_date')::date,(r->>'start_time')::time,p_actor from jsonb_array_elements(p_rows) r
 on conflict(employee_id,work_date) do update set start_time=excluded.start_time,updated_at=now(),updated_by=p_actor;
 end if;
 if p_submit then
 if char_length(p_note)>500 then raise exception '備考は500字までで入力してください。'; end if;
 insert into system_shift_submission(employee_id,year_month,updated_by,note) values(p_employee,p_month,p_actor,p_note) on conflict(employee_id,year_month) do update set submitted_at=now(),updated_at=now(),updated_by=p_actor,note=p_note;
 end if;
end $$;

revoke all on function public.save_shift_person(text,text,jsonb,text,boolean,text),
  public.decide_attendance_correction(bigint,text,text,text,boolean),
  public.import_kot_attendance_day(text,date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_shift_person(text,text,jsonb,text,boolean,text),
  public.decide_attendance_correction(bigint,text,text,text,boolean),
  public.import_kot_attendance_day(text,date,jsonb,jsonb) to service_role;
insert into public.system_view_scopes(page_key,tab_key,label,default_roles) values
('system-attendance','punch','勤怠打刻：打刻',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
('system-attendance','request','勤怠打刻：修正の申請',array['toss','closer','cs','staff','outsource','manager','admin','super_admin']::text[]),
('system-attendance','approve','勤怠打刻：修正の承認',array['manager','admin','super_admin']::text[])
on conflict(page_key,tab_key) do update set label=excluded.label,default_roles=excluded.default_roles;
alter table public.system_attendance_kot_send add column attempt_id uuid, add column processing_until timestamptz;
create function public.claim_attendance_send(p_employee text,p_date date,p_ids bigint[],p_attempt uuid)
returns void language plpgsql set search_path=public as $$
declare start_date date;
begin
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||p_employee||':'||p_date,0));
  select kot_send_start_date into start_date from system_attendance_settings where id=true for share;
  if start_date is null or p_date<start_date then raise exception '開始日より前の打刻は送れません。'; end if;
  if exists(select 1 from system_attendance_kot_send where employee_id=p_employee and work_date=p_date
    and (status in ('sent','manual') or processing_until>now())) then raise exception '送信済み、または処理中です。'; end if;
  if exists(select 1 from system_attendance_corrections where employee_id=p_employee and work_date=p_date and status='pending') then raise exception '未承認の修正があります。'; end if;
  perform pg_advisory_xact_lock(hashtext('attendance-export'));
  if exists(select 1 from system_attendance_punches where kot_sync_status='sending' and kot_batch_id is not null and voided_at is null)
    or exists(select 1 from system_attendance_kot_batch where status='sending') then raise exception '同期状況の画面の処理が途中です。'; end if;
  if (select array_agg(id order by id) from system_attendance_punches where employee_id=p_employee
    and (punched_at at time zone 'Asia/Tokyo')::date=p_date and voided_at is null)
    is distinct from (select array_agg(v order by v) from unnest(p_ids) v) then raise exception '打刻が変わりました。読み直してください。'; end if;
  insert into system_attendance_kot_send(employee_id,work_date,status,attempt_id,processing_until)
    values(p_employee,p_date,'unknown',p_attempt,now()+interval '5 minutes')
    on conflict(employee_id,work_date) do update set attempt_id=p_attempt,processing_until=excluded.processing_until;
  update system_attendance_punches set kot_sync_status='sending' where id=any(p_ids);
end $$;
create function public.finish_attendance_send(p_employee text,p_date date,p_attempt uuid,p_status text,p_error text,p_rows jsonb,p_actor text)
returns void language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||p_employee||':'||p_date,0));
  update system_attendance_kot_send set status=p_status,error=p_error,rows=p_rows,sent_by=p_actor,
    sent_at=case when p_status='sent' then now() else null end,updated_at=now(),processing_until=null
    where employee_id=p_employee and work_date=p_date and attempt_id=p_attempt;
  if not found then raise exception '送信結果が競合しました。'; end if;
  update system_attendance_punches set kot_sync_status=case when p_status='sent' then 'synced' when p_status='failed' then 'unsent' else 'sending' end,
    kot_synced_at=case when p_status='sent' then now() else null end
    where employee_id=p_employee and (punched_at at time zone 'Asia/Tokyo')::date=p_date and voided_at is null;
end $$;
revoke all on function public.claim_attendance_send(text,date,bigint[],uuid),public.finish_attendance_send(text,date,uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_attendance_send(text,date,bigint[],uuid),public.finish_attendance_send(text,date,uuid,text,text,jsonb,text) to service_role;
/* $catalog$[{"table":"system_attendance_corrections","fields":[{"path":["reason"],"phone":false},{"path":["decided_comment"],"phone":false}]}]$catalog$ */
create view public.search_v_system_attendance_corrections with (security_invoker=true) as
  select t.*,public.garden_search_join(public.search_norm(t.reason,false),public.search_norm(t.decided_comment,false)) as search_text
  from public.system_attendance_corrections t;
revoke all on public.search_v_system_attendance_corrections from public,anon,authenticated;
grant select on public.search_v_system_attendance_corrections to service_role;
create index attendance_corrections_search_trgm_idx on public.system_attendance_corrections using gin
  ((public.garden_search_join(public.search_norm(reason,false),public.search_norm(decided_comment,false))) public.gin_trgm_ops);
create function public.guard_attendance_correction_insert() returns trigger language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||new.employee_id||':'||new.work_date,0));
  if new.work_date>(now() at time zone 'Asia/Tokyo')::date then raise exception '未来の日には申請できません。'; end if;
  if exists(select 1 from system_attendance_punches where employee_id=new.employee_id
    and (punched_at at time zone 'Asia/Tokyo')::date=new.work_date and kot_sync_status='sending' and voided_at is null) then
    raise exception '送信の処理中です。完了後に申請してください。';
  end if;
  return new;
end $$;
revoke all on function public.guard_attendance_correction_insert() from public,anon,authenticated;
create trigger attendance_correction_insert before insert on public.system_attendance_corrections
  for each row execute function public.guard_attendance_correction_insert();
create function public.mark_attendance_manual(p_employee text,p_date date,p_actor text) returns void
language plpgsql set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('attendance:'||p_employee||':'||p_date,0));
  if now()<((p_date+2)::timestamp at time zone 'Asia/Tokyo') then raise exception '期限切れの日だけ入力済みにできます。'; end if;
  if exists(select 1 from system_attendance_corrections where employee_id=p_employee and work_date=p_date and status='pending')
    or exists(select 1 from system_attendance_kot_send where employee_id=p_employee and work_date=p_date and processing_until>now()) then
    raise exception '修正または送信の処理中です。';
  end if;
  insert into system_attendance_kot_send(employee_id,work_date,status,sent_by,sent_at)
    values(p_employee,p_date,'manual',p_actor,now())
    on conflict(employee_id,work_date) do update set status='manual',sent_by=p_actor,sent_at=now(),updated_at=now(),processing_until=null;
  update system_attendance_punches set kot_sync_status='synced',kot_synced_at=now()
    where employee_id=p_employee and (punched_at at time zone 'Asia/Tokyo')::date=p_date and voided_at is null;
end $$;
create function public.guard_attendance_csv_claim() returns trigger language plpgsql set search_path=public as $$
begin
  if new.kot_sync_status='sending' and new.kot_batch_id is not null and old.kot_sync_status='unsent' then
    if not pg_try_advisory_xact_lock(hashtext('attendance-export')) then
      raise exception '打刻の送信の処理中です。完了後にもう一度押してください。';
    end if;
    if exists(select 1 from system_attendance_kot_send where processing_until>now() or status='unknown') then
      raise exception '打刻の送信または結果の確認が途中です。';
    end if;
  end if;
  return new;
end $$;
create trigger attendance_csv_claim before update on public.system_attendance_punches
  for each row execute function public.guard_attendance_csv_claim();
revoke all on function public.mark_attendance_manual(text,date,text),public.guard_attendance_csv_claim() from public,anon,authenticated;
grant execute on function public.mark_attendance_manual(text,date,text) to service_role;
commit;
