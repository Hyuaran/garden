-- 管理表ポータル 段階2b-1：人ごとの設定（実績管理シートの B〜F 列の置き換え）
-- Supabase の SQL Editor で実行する。閲覧は責任者以上、書き込みはサーバー側（service_role）だけ。
begin;

create table if not exists public.system_kanri_person (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- Excel・Kintone の表記（姓と名の間は全角スペース）
  kot_name text,                      -- KOT の表記（半角スペース）
  team text not null,                 -- チーム名（Excel F 列：宮永チーム／小泉チーム／石原チーム／チーム／訪問営業）
  department text not null,           -- 部署名（Excel E 列：宮永チーム／小泉チーム／石原チーム／社員／関電）
  employment_kind text not null check (employment_kind in ('社員','アルバイト','派遣')),
  base_wage integer,                  -- 基準時給（アルバイトのみ）。社員・派遣は null
  is_field_sales boolean not null default false,  -- 訪販（関電）の人
  employee_id text references public.root_employees(employee_id),  -- 従業員台帳との紐づけ（分かる人だけ・任意）
  active boolean not null default true,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

alter table public.system_kanri_person enable row level security;
drop policy if exists system_kanri_person_select_manager on public.system_kanri_person;
create policy system_kanri_person_select_manager on public.system_kanri_person for select to authenticated using (public.has_role_at_least('manager'));
grant select on public.system_kanri_person to authenticated;
grant all on public.system_kanri_person to service_role;

-- 初期値：8/31 の実績管理シート（B〜F 列）そのまま（28 人）
insert into public.system_kanri_person (name, kot_name, team, department, employment_kind, base_wage, is_field_sales) values
  ('萩尾　拓也', '萩尾 拓也', '訪問営業', '関電', '社員', null, true),
  ('桐井　大輔', '桐井 大輔', '訪問営業', '関電', '社員', null, true),
  ('小泉　翔', '小泉 翔', 'チーム', '小泉チーム', '社員', null, false),
  ('宮永　ひかり', '宮永 ひかり', 'チーム', '宮永チーム', '社員', null, false),
  ('石原　孝志朗', '石原 孝志朗', 'チーム', '石原チーム', '社員', null, false),
  ('田中　実花', '田中 実花', '小泉チーム', '小泉チーム', 'アルバイト', 1400, false),
  ('毛利　祐星', '毛利 祐星', '石原チーム', '石原チーム', 'アルバイト', 1575, false),
  ('南薗　優樹', '南薗 優樹', '宮永チーム', '宮永チーム', 'アルバイト', 1400, false),
  ('林　佳音', '林 佳音', '宮永チーム', '宮永チーム', 'アルバイト', 1525, false),
  ('宮本　桃華', '宮本 桃華', '宮永チーム', '宮永チーム', 'アルバイト', 1300, false),
  ('樋本　葵', '樋本 葵', '小泉チーム', '小泉チーム', 'アルバイト', 1300, false),
  ('谷本　結那', '谷本 結那', '石原チーム', '石原チーム', 'アルバイト', 1400, false),
  ('森　健登', '森 健登', '石原チーム', '石原チーム', 'アルバイト', 1400, false),
  ('高木　麟心愛', '高木 麟心愛', '石原チーム', '石原チーム', 'アルバイト', 1300, false),
  ('劉　恵美', '劉 恵美', '宮永チーム', '宮永チーム', 'アルバイト', 1400, false),
  ('舩木　稜太', '舩木 稜太', '小泉チーム', '小泉チーム', 'アルバイト', 1500, false),
  ('西野　紗良', '西野 紗良', '石原チーム', '石原チーム', 'アルバイト', 1300, false),
  ('長田　蒼空', '長田 蒼空', '石原チーム', '石原チーム', 'アルバイト', 1300, false),
  ('神田　七星', '神田 七星', '宮永チーム', '宮永チーム', 'アルバイト', 1400, false),
  ('藪田　るい', '藪田 るい', '宮永チーム', '宮永チーム', 'アルバイト', 1300, false),
  ('岩下　英美', '岩下 英美', '宮永チーム', '宮永チーム', 'アルバイト', 1400, false),
  ('竹上　栄秀', '竹上 栄秀', '小泉チーム', '小泉チーム', 'アルバイト', 1300, false),
  ('藤木　誠希', '藤木 誠希', '小泉チーム', '小泉チーム', 'アルバイト', 1400, false),
  ('桑岡　優愛', '桑岡 優愛', '宮永チーム', '宮永チーム', 'アルバイト', 1300, false),
  ('廣門　彩季', '廣門 彩季', '小泉チーム', '小泉チーム', 'アルバイト', 1500, false),
  ('梶野　恵園', '梶野 恵園', '小泉チーム', '小泉チーム', '派遣', null, false),
  ('小谷　庵', '小谷 庵', 'チーム', '小泉チーム', '派遣', null, false),
  ('藤田　悠誠', '藤田 悠誠', 'チーム', '石原チーム', '派遣', null, false)
on conflict (name) do nothing;

update public.system_kanri_person p set sort_order = s.rn * 10
from (select name, row_number() over (order by department, name) as rn from public.system_kanri_person) s where s.name = p.name;

comment on table public.system_kanri_person is '管理表ポータルの人ごとの設定（実績管理シートの氏名・KOT名・雇用区分・基準時給・部署・チーム）。正は将来 従業員台帳に寄せる。';

commit;
