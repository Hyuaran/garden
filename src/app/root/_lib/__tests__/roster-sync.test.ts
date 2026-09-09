import { describe, expect, it } from "vitest";
import { existingNumberKey, mapRosterRecordToRoot, normalizeEmployeeNumber, roleFromRoster } from "../roster-sync.server";
import type { KintoneRecord } from "@/lib/kintone/records";

function record(values: Record<string, unknown>): KintoneRecord {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));
}

describe("Root の社員番号と名簿から作る番号のそろえ方", () => {
  it("打刻 ID の無い人の R 番号は 4 桁に詰めない（詰めると毎朝 84 人が新規扱いになり同期が止まる）", () => {
    for (const recordId of ["1", "10", "99", "112"]) {
      const fromRoster = normalizeEmployeeNumber(record({ 打刻ID: "", $id: recordId }));
      expect(fromRoster).toBe(`R${recordId}`);
      expect(existingNumberKey(`R${recordId}`)).toBe(fromRoster);
    }
  });

  it("数字だけの社員番号は 4 桁にそろえ、5 桁以上はそのまま", () => {
    expect(existingNumberKey("8")).toBe("0008");
    expect(existingNumberKey("1530")).toBe("1530");
    expect(existingNumberKey("999990")).toBe("999990");
    expect(existingNumberKey(normalizeEmployeeNumber(record({ 打刻ID: "8" })))).toBe("0008");
  });
});

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
      打刻ID: "1530",
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
      社員番号: "0077",
      打刻ID: "1078",
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

describe("roster employee number key", () => {
  it("uses the KOT punch id (same numbering as Root) and never the roster 社員番号", () => {
    expect(normalizeEmployeeNumber(record({ 社員番号: "0091", 打刻ID: "1165" }))).toBe("1165");
    expect(normalizeEmployeeNumber(record({ 社員番号: "0091", 打刻ID: "8" }))).toBe("0008");
  });
  it("registers rows without a punch id as history keyed by the roster record id", () => {
    expect(normalizeEmployeeNumber(record({ 社員番号: "0012", 打刻ID: "", $id: "374" }))).toBe("R374");
    expect(normalizeEmployeeNumber(record({ 社員番号: "0012" }))).toBe("");
  });
});

describe("roster duplicate punch ids", () => {
  it("keeps the active (rehired) row when the same punch id appears twice", async () => {
    const { syncRootRoster } = await import("../roster-sync.server");
    const records = [
      record({ $id: "10", 打刻ID: "1354", 従業員名_姓名: "林 佳音", 従業員ステータス: "退職済み", 退職日: "2023-07-31", 入社日: "2021-01-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02" }),
      record({ $id: "500", 打刻ID: "1354", 従業員名_姓名: "林 佳音", 従業員ステータス: "在籍中", 退職日: "", 入社日: "2026-04-01", 雇用形態: "アルバイト", 生年月日: "2000-01-02" }),
    ];
    process.env.KINTONE_EMPLOYEE_ROSTER_TOKEN = "test-token";
    process.env.KINTONE_SUBDOMAIN = "example";
    process.env.KINTONE_EMPLOYEE_ROSTER_APP_ID = "56";
    const inserted: Record<string, unknown>[] = [];
    const supabase = {
      from: (table: string) => ({
        select: () => Promise.resolve({ data: [], error: null }),
        insert: (row: Record<string, unknown>) => { if (table === "root_employees") inserted.push(row); return Promise.resolve({ error: null }); },
      }),
      auth: { admin: { createUser: async () => ({ data: { user: { id: "user-new" } }, error: null }), updateUserById: async () => ({ data: null, error: null }) } },
    } as never;
    const fetchStub = () => Promise.resolve(new Response(JSON.stringify({ records }), { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = fetchStub as typeof fetch;
    try {
      const summary = await syncRootRoster({ dryRun: false, supabase, now: new Date("2026-09-09T03:00:00Z") });
      expect(summary.created).toBe(1);
      expect(inserted[0]).toMatchObject({ employee_number: "1354", is_active: true, hire_date: "2026-04-01" });
      expect(summary.errors.some((e) => e.includes("重複"))).toBe(true);
    } finally {
      globalThis.fetch = original;
    }
  });
});

