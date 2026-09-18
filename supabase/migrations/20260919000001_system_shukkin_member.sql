create table if not exists public.system_shukkin_member (
  id uuid primary key default gen_random_uuid(),
  employee_number text not null unique references public.root_employees(employee_number),
  group_name text not null,
  sort_order integer not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint system_shukkin_member_employee_number_check check (employee_number ~ '^[0-9]{4}$'),
  constraint system_shukkin_member_group_name_check check (group_name in ('訪販社員','ＢＹ','テレマ社員','宮永チーム','小泉チーム','石原チーム'))
);

create index if not exists idx_system_shukkin_member_group_sort
  on public.system_shukkin_member (group_name, sort_order)
  where active = true;

create or replace function public.set_system_shukkin_member_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_system_shukkin_member_updated_at on public.system_shukkin_member;
create trigger trg_system_shukkin_member_updated_at
  before update on public.system_shukkin_member
  for each row execute function public.set_system_shukkin_member_updated_at();

alter table public.system_shukkin_member enable row level security;

drop policy if exists system_shukkin_member_select_staff on public.system_shukkin_member;
create policy system_shukkin_member_select_staff
  on public.system_shukkin_member
  for select
  using (public.garden_role_of(auth.uid()) in ('staff','outsource','manager','admin','super_admin'));

drop policy if exists system_shukkin_member_write_manager on public.system_shukkin_member;
create policy system_shukkin_member_write_manager
  on public.system_shukkin_member
  for all
  using (public.garden_role_of(auth.uid()) in ('manager','admin','super_admin'))
  with check (public.garden_role_of(auth.uid()) in ('manager','admin','super_admin'));

with desired(name, group_name, sort_order) as (
  values
    ('萩尾 拓也','訪販社員',10),
    ('桐井 大輔','訪販社員',20),
    ('東海林 美琴','ＢＹ',10),
    ('簡 棣榮','ＢＹ',20),
    ('上田 基人','テレマ社員',10),
    ('宮永 ひかり','テレマ社員',20),
    ('小泉 翔','テレマ社員',30),
    ('石原 孝志朗','テレマ社員',40),
    ('林 佳音','宮永チーム',10),
    ('南薗 優樹','宮永チーム',20),
    ('宮本 桃華','宮永チーム',30),
    ('神田 七星','宮永チーム',40),
    ('桑岡 優愛','宮永チーム',50),
    ('小谷 庵','小泉チーム',10),
    ('梶野 恵園','小泉チーム',20),
    ('田中 実花','小泉チーム',30),
    ('樋本 葵','小泉チーム',40),
    ('劉 恵美','小泉チーム',50),
    ('舩木 稜太','小泉チーム',60),
    ('藤木 誠希','小泉チーム',70),
    ('竹上 栄秀','小泉チーム',80),
    ('西野 紗良','小泉チーム',90),
    ('毛利 祐星','石原チーム',10),
    ('高木 麟心愛','石原チーム',20),
    ('谷本 結那','石原チーム',30),
    ('森 健登','石原チーム',40),
    ('廣門 彩季','石原チーム',50),
    ('長田 蒼空','石原チーム',60),
    ('藤田 悠誠','石原チーム',70)
)
-- root_employees.name は姓と名の間が全角スペース（例「東海林　美琴」）なので、空白の種類を無視して突き合わせる。
-- 同じ名前が複数いるときは在籍中・削除されていない人を優先する。
, matched as (
  select distinct on (d.name) e.employee_number, d.group_name, d.sort_order
  from desired d
  join public.root_employees e
    on regexp_replace(e.name, '[[:space:]　]+', ' ', 'g') = d.name
  where e.employee_number is not null
  order by d.name, (e.deleted_at is null) desc, e.is_active desc
)
insert into public.system_shukkin_member (employee_number, group_name, sort_order, active)
select m.employee_number, m.group_name, m.sort_order, true
from matched m
on conflict (employee_number) do update set
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  active = true;

-- root_employees に氏名が見つからない人は上の初期投入では入りません。
-- 適用後に desired と root_employees の左結合で確認し、必要なら社員番号で追加してください。
