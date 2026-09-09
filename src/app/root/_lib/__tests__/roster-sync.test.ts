import { describe, expect, it } from "vitest";
import { mapRosterRecordToRoot, roleFromRoster } from "../roster-sync.server";
import type { KintoneRecord } from "@/lib/kintone/records";

function record(values: Record<string, unknown>): KintoneRecord {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
}

describe("roster sync mapping", () => {
  it("maps roster fields to root employee columns without overriding protected existing values", () => {
    const mapped = mapRosterRecordToRoot(record({
      社員番号: "1530",
      従業員名_姓名: "神田 七星",
      従業員名_姓名カナ: "カンダ ナナセ",
      生年月日: "2001-05-02",
      入社日: "2026-05-01",
      退職日: "",
      従業員ステータス: "在籍中",
      雇用形態: "アルバイト",
      基準時給: "1500",
      打刻ID: "K1530",
      交通費_片道: "500",
    }), {
      employee_id: "EMP-1530",
      employee_number: "1530",
      name: "old",
      name_kana: "old",
      company_id: "COMP-001",
      employment_type: "アルバイト",
      salary_system_id: "SAL-SYS-001",
      hire_date: "2026-01-01",
      termination_date: null,
      email: "",
      kot_employee_id: null,
      commute_daily_allowance: 1200,
      garden_role: "manager",
      garden_role_manual: true,
      user_id: "user-1",
      is_active: true,
      birthday: null,
    }, "2026-09-09");

    expect(mapped).toMatchObject({
      employee_id: "EMP-1530",
      employee_number: "1530",
      name: "神田 七星",
      birthday: "2001-05-02",
      hire_date: "2026-05-01",
      commute_daily_allowance: 1200,
      garden_role: "manager",
      is_active: true,
    });
  });

  it("uses retirement date in active calculation", () => {
    const mapped = mapRosterRecordToRoot(record({
      社員番号: "1078",
      従業員名_姓名: "松本 美菜里",
      退職日: "2026-09-09",
      従業員ステータス: "在籍中",
    }), null, "2026-09-09");
    expect(mapped.is_active).toBe(false);
  });

  it("assigns part-time roles from base wage with the 1500 yen training exception", () => {
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1450" }))).toBe("closer");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1500" }))).toBe("toss");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1300" }))).toBe("toss");
    expect(roleFromRoster(record({ 雇用形態: "アルバイト", 基準時給: "1600", チーム名: "バックヤード" }))).toBe("staff");
  });
});
