import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20261104000517_shift_default_pattern.sql", "utf8").replace(/\r\n/g, "\n");
it("候補のSQLは平日の検査だけを拡張し、517版のほかの処理を維持する", () => {
  const next = readFileSync("supabase/migrations/20261104000518_shift_default_options.sql", "utf8").replace(/\r\n/g, "\n");
  const previousFunction = migration.split("create or replace function public.save_shift_person(")[1]
    .split("create or replace function public.confirm_shift_month")[0].trim();
  const nextFunction = next.split("create or replace function public.save_shift_person(")[1]
    .split("commit;")[0].trim();
  const extension = `if (starts is distinct from pattern.start_time or ends is distinct from pattern.end_time or starts is null)
        and not (shift_default_weekday(d) between 1 and 5 and exists (
          select 1 from system_shift_default_option o
          where o.employee_id=p_employee and o.start_time=starts and o.end_time=ends
        )) then`;
  expect(nextFunction.replace(extension,
    "if starts is distinct from pattern.start_time or ends is distinct from pattern.end_time or starts is null then"))
    .toBe(previousFunction);
  expect(next).toContain("system_shift_default_option enable row level security");
  expect(next).toContain("grant all on public.system_shift_default_option to service_role");
});
it("未提出の既定・定休日の限定・有給の変更による送信状態の解除をSQLにも置く", () => {
  const confirm = migration.split("create or replace function public.confirm_shift_month")[1].split("create or replace function public.apply_shift_holidays")[0];
  expect(confirm).toContain("left join system_shift_default");
  expect(confirm).toContain("when w.employee_id is not null then w.start_time else p.start_time");
  expect(confirm).toContain("shift_person_mode(e)='telema'");
  const trigger = migration.split("create or replace function public.apply_shift_holidays")[1];
  expect(trigger).toContain("shift_person_mode(employee_id)='telema'");
  expect(trigger).toContain("new.day_kind is distinct from old.day_kind");
  expect(trigger).toContain("new.kot_manual_at := null");
});
it("曜日の既定を選ぶSQLの祝日と画面の祝日を一致させる", () => {
  const source = readFileSync("src/app/system/kanri/_lib/jp-holidays.ts", "utf8");
  const dates = (text: string) => [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)].map(match => match[0]).sort();
  expect(dates(migration.split("create function public.shift_default_weekday")[1].split("$$;")[0])).toEqual(dates(source));
});
