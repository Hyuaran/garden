import { describe, it, expect } from "vitest";
import { monthDays, startOptions, validateDays, deadline, holidayCandidates, confirmDays } from "./rules";
import { isShiftEligible } from "./eligibility";
describe("rules case 1", () => {
  it("rules case 2", () => {
    expect(startOptions("2026-11-04")).toEqual([
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
      "17:30",
      "18:00",
    ]);
    expect(startOptions("2026-11-03")[0]).toBe("10:00");
    expect(startOptions("2026-11-07")[0]).toBe("10:00");
    expect(startOptions("2026-11-08")[0]).toBe("10:00");
  });
  it("rules case 3", () => {
    const rows = monthDays("2026-11").map((work_date) => ({ work_date, start_time: null as string | null }));
    for (const value of ["13:30", "14:15", "18:30", "14:00:01"]) {
      const invalid = rows.map((r) => (r.work_date === "2026-11-04" ? { ...r, start_time: value } : r));
      expect(() => validateDays("2026-11", invalid)).toThrow();
    }
    expect(() => validateDays("2026-11", rows.slice(1))).toThrow();
    expect(() => validateDays("2026-11", [...rows.slice(1), rows[1]])).toThrow();
    expect(() =>
      validateDays(
        "2026-11",
        rows.map((r) => ({ ...r, start_time: "14:00", end_time: "20:00" })),
      ),
    ).toThrow();
    expect(validateDays("2026-11", rows)).toHaveLength(30);
  });
  it("rules case 4", () => {
    const limit = deadline("2026-12").getTime();
    expect(new Date(limit).toISOString()).toBe("2026-11-15T14:59:59.999Z");
    expect(new Date("2026-11-15T23:59:59+09:00").getTime()).toBeLessThan(limit);
    expect(new Date("2026-11-16T00:00:00+09:00").getTime()).toBeGreaterThan(limit);
    expect(deadline("2027-01").toISOString()).toBe("2026-12-15T14:59:59.999Z");
  });
  it("eligibility", () => {
    const e = {
      employee_id: "1",
      name: "山田",
      employment_type: "アルバイト",
      business: "ブロードバンド事業",
      current_team: "宮永チーム",
      is_active: true,
    };
    expect(isShiftEligible(e)).toBe(true);
    for (const other of [
      { employment_type: "正社員" },
      { business: "他事業" },
      { current_team: "バックヤード" },
      { current_team: "所属なし" },
      { current_team: null },
      { is_active: false },
      { termination_date: "2020-01-01" },
      { deleted_at: "2026-01-01" },
    ])
      expect(isShiftEligible({ ...e, ...other })).toBe(false);
  });
  it("rules case 5", () => {
    const rows = [
      { work_date: "2026-11-01", start_time: "14:00" },
      { work_date: "2026-11-02", start_time: "18:00" },
    ];
    expect(holidayCandidates(["2026-11-01", "2026-11-02"], rows).map((r) => r.hours)).toEqual([3, 7]);
    expect(confirmDays(rows, ["2026-11-01"])).toEqual([
      { work_date: "2026-11-01", start_time: null, end_time: null },
      { work_date: "2026-11-02", start_time: "18:00", end_time: "21:00" },
    ]);
  });
});
