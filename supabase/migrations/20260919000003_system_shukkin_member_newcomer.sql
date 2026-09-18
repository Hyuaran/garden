-- 出勤表の区分に「新人チーム」を足す＋並びの追加（東海林さん 2026-09-19）
-- 訪販社員：桐井 大輔の下に 吉田 陽菜（1559）・後道 健一（1560）
-- 新人チーム（チーム所属前）：北野 晟（1557・派遣）・山田 菫（1561・派遣）・髙林 茜斗（1558）

alter table public.system_shukkin_member
  drop constraint if exists system_shukkin_member_group_name_check;

alter table public.system_shukkin_member
  add constraint system_shukkin_member_group_name_check
  check (group_name in ('訪販社員','ＢＹ','テレマ社員','宮永チーム','小泉チーム','石原チーム','新人チーム'));

insert into public.system_shukkin_member (employee_number, group_name, sort_order, active, display_name)
values
  ('1559','訪販社員',30,true,'吉田 陽菜'),
  ('1560','訪販社員',40,true,'後道 健一'),
  ('1557','新人チーム',10,true,'北野 晟'),
  ('1561','新人チーム',20,true,'山田 菫'),
  ('1558','新人チーム',30,true,'髙林 茜斗')
on conflict (employee_number) do update set
  group_name = excluded.group_name,
  sort_order = excluded.sort_order,
  active = true,
  display_name = excluded.display_name;
