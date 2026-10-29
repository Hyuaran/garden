begin;
alter table public.root_employees add column line_contact_url text not null default ''
  check (line_contact_url = '' or line_contact_url like 'https://line.me/%');
alter table public.system_line_contact add column employee_id text references public.root_employees(employee_id);
with seeds(number, role, url) as (values
 ('1165','miyanaga','https://line.me/ti/p/-xQCaOeokf'),
 ('1326','team:小泉チーム','https://line.me/ti/p/gkj0hZCq83'),
 ('1523','team:石原チーム','https://line.me/ti/p/9x7lHB1Uy0'),
 ('1508','nhk','https://line.me/ti/p/k8yMfVVJWG'),
 ('0008','office','https://line.me/ti/p/KRNGw6Bi-N'))
update public.root_employees e set line_contact_url=s.url from seeds s
where lpad(e.employee_number::text,4,'0')=s.number;
with seeds(number, role) as (values ('1165','miyanaga'),('1326','team:小泉チーム'),('1523','team:石原チーム'),('1508','nhk'),('0008','office'))
update public.system_line_contact c set employee_id=e.employee_id,url=''
from seeds s join public.root_employees e on lpad(e.employee_number::text,4,'0')=s.number where c.key=s.role;
update public.system_line_contact set label=case key
 when 'miyanaga' then 'マネージャー' when 'team:小泉チーム' then '小泉チームのリーダー'
 when 'team:石原チーム' then '石原チームのリーダー' when 'nhk' then 'NHK派遣事業の担当'
 when 'office' then '事務・その他の担当' else '会社のホームページ' end,
 url=case when key='guest_home' then url else '' end;
-- Serialize assignment/removal on the employee row, including changes from Root.
create function public.guard_line_contact_removal() returns trigger language plpgsql set search_path=public as $$
begin
 if coalesce(new.line_contact_url,'')='' and exists(select 1 from system_line_contact where employee_id=new.employee_id) then
  raise exception '先にリッチメニュータブで担当を変更してください。';
 end if;
 return new;
end $$;
create trigger guard_line_contact_removal before update of line_contact_url on public.root_employees for each row execute function public.guard_line_contact_removal();
create function public.guard_line_contact_assignment() returns trigger language plpgsql set search_path=public as $$
declare contact_url text;
begin
 if new.employee_id is not null then
  select line_contact_url into contact_url from root_employees where employee_id=new.employee_id for update;
  if coalesce(contact_url,'')='' then raise exception '連絡先のある人を選んでください。'; end if;
 end if;
 return new;
end $$;
create trigger guard_line_contact_assignment before insert or update of employee_id on public.system_line_contact for each row execute function public.guard_line_contact_assignment();
commit;
