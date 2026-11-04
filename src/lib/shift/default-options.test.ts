import { expect, it } from "vitest";
import { defaultDays, validateDefaultDays, type DefaultPattern } from "./rules";
import { validateOptions } from "./defaults.server";

const pattern: DefaultPattern[] = [0, 1, 2, 3, 4, 5, 6, 8].map(weekday => ({
  weekday,
  start_time: weekday >= 1 && weekday <= 5 ? "10:30" : null,
  end_time: weekday >= 1 && weekday <= 5 ? "14:30" : null,
}));
const options = [{ label: "出社", start_time: "12:00", end_time: "17:00" }];

it("選べる勤務は平日だけ通り、登録なしの検査と既定勤務を維持する", () => {
  const rows = defaultDays("2027-01", pattern);
  expect(validateDefaultDays("2027-01", rows, pattern, false, options)).toEqual(rows);
  for (const date of ["2027-01-04", "2027-01-09", "2027-01-10", "2027-01-11"]) {
    const changed = rows.map(row => row.work_date === date
      ? { ...row, start_time: "12:00", end_time: "17:00", day_kind: "work" as const } : row);
    const validate = () => validateDefaultDays("2027-01", changed, pattern, false, options);
    if (date === "2027-01-04") expect(validate).not.toThrow();
    else expect(validate).toThrow();
    expect(() => validateDefaultDays("2027-01", changed, pattern)).toThrow();
  }
});

it("選べる勤務は名前と30分単位の時刻が必要、空の一覧は削除として受ける", () => {
  expect(validateOptions([])).toEqual([]);
  expect(validateOptions(options)).toEqual(options);
  for (const row of [null, { ...options[0], label: " " },
    { ...options[0], start_time: "12:10" }, { ...options[0], end_time: "12:00" }]) {
    expect(() => validateOptions([row])).toThrow();
  }
});
