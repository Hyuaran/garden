-- 付与ポイント表を登録・変更できる人（全権管理者のほかに）。毎月、営業が Garden で登録する（2026-11-20 東海林さん）。
create table if not exists public.soil_product_points_editors (
  employee_number text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.soil_product_points_editors enable row level security;
revoke all on public.soil_product_points_editors from anon, authenticated;
grant select, insert, update, delete on public.soil_product_points_editors to service_role;

insert into public.soil_product_points_editors (employee_number, note) values
  ('0004', '上田 基人'),
  ('1165', '宮永 ひかり'),
  ('1326', '小泉 翔'),
  ('1523', '石原 孝志朗')
on conflict (employee_number) do nothing;
