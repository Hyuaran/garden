/**
 * T-F4-02: tax-calendar.ts 純粋ユーティリティのテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §5 Step 1
 *
 * - buildRolling12Months: 当月を中心とした 12 ヶ月配列（前 5 + 当月 + 後 6）
 * - buildYearGroups: 連続する月を年単位でグループ化、zebra 交互
 * - isPastMonth / isCurrentMonth: 当月境界の判定
 * - pivotSchedulesToCells: schedules を法人 × 12 セルに ピボット
 */

import { describe, it, expect } from "vitest";

import {
  buildRolling12Months,
  buildYearGroups,
  isCurrentMonth,
  isPastMonth,
  pivotSchedulesToCells,
} from "@/app/forest/_lib/tax-calendar";
import type { NouzeiScheduleWithItems } from "@/app/forest/_lib/types";

describe("buildRolling12Months", () => {
  it("returns 12 months: 5 before + current + 6 after", () => {
    const now = new Date(2026, 3, 25); // 2026-04-25 (April)
    const result = buildRolling12Months(now);

    expect(result).toHaveLength(12);
    // 5 ヶ月前 = 2025/11
    expect(result[0]).toEqual({ y: 2025, m: 11 });
    // 当月 = 2026/04（index 5）
    expect(result[5]).toEqual({ y: 2026, m: 4 });
    // 6 ヶ月後 = 2026/10（index 11）
    expect(result[11]).toEqual({ y: 2026, m: 10 });
  });

  it("handles year boundary (December)", () => {
    const now = new Date(2026, 11, 1); // 2026-12-01
    const result = buildRolling12Months(now);

    expect(result[0]).toEqual({ y: 2026, m: 7 });
    expect(result[5]).toEqual({ y: 2026, m: 12 });
    expect(result[11]).toEqual({ y: 2027, m: 6 });
  });

  it("handles year boundary (January)", () => {
    const now = new Date(2026, 0, 15); // 2026-01-15
    const result = buildRolling12Months(now);

    expect(result[0]).toEqual({ y: 2025, m: 8 });
    expect(result[5]).toEqual({ y: 2026, m: 1 });
    expect(result[11]).toEqual({ y: 2026, m: 7 });
  });
});

describe("buildYearGroups", () => {
  it("groups consecutive months by year and alternates zebra", () => {
    // 2025/11, 2025/12, 2026/01...2026/10 (12 月)
    const monthYears = [
      { y: 2025, m: 11 },
      { y: 2025, m: 12 },
      { y: 2026, m: 1 },
      { y: 2026, m: 2 },
      { y: 2026, m: 3 },
      { y: 2026, m: 4 },
      { y: 2026, m: 5 },
      { y: 2026, m: 6 },
      { y: 2026, m: 7 },
      { y: 2026, m: 8 },
      { y: 2026, m: 9 },
      { y: 2026, m: 10 },
    ];
    const result = buildYearGroups(monthYears);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      year: 2025,
      startIdx: 0,
      span: 2,
      bgClass: "bg-zebra-a",
    });
    expect(result[1]).toMatchObject({
      year: 2026,
      startIdx: 2,
      span: 10,
      bgClass: "bg-zebra-b",
    });
  });

  it("handles single-year span", () => {
    const monthYears = Array.from({ length: 12 }, (_, i) => ({
      y: 2026,
      m: i + 1,
    }));
    const result = buildYearGroups(monthYears);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ year: 2026, startIdx: 0, span: 12 });
  });

  it("handles 3-year span (rare edge case)", () => {
    const monthYears = [
      { y: 2025, m: 12 },
      { y: 2026, m: 1 },
      { y: 2026, m: 12 },
      { y: 2027, m: 1 },
    ];
    const result = buildYearGroups(monthYears);
    expect(result.map((g) => g.year)).toEqual([2025, 2026, 2027]);
    expect(result.map((g) => g.span)).toEqual([1, 2, 1]);
    expect(result.map((g) => g.bgClass)).toEqual([
      "bg-zebra-a",
      "bg-zebra-b",
      "bg-zebra-a",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(buildYearGroups([])).toEqual([]);
  });
});

describe("isPastMonth", () => {
  const now = new Date(2026, 3, 25); // 2026-04-25

  it("returns true for past year", () => {
    expect(isPastMonth({ y: 2025, m: 12 }, now)).toBe(true);
  });

  it("returns true for past month within same year", () => {
    expect(isPastMonth({ y: 2026, m: 3 }, now)).toBe(true);
  });

  it("returns false for current month", () => {
    expect(isPastMonth({ y: 2026, m: 4 }, now)).toBe(false);
  });

  it("returns false for future month within same year", () => {
    expect(isPastMonth({ y: 2026, m: 5 }, now)).toBe(false);
  });

  it("returns false for future year", () => {
    expect(isPastMonth({ y: 2027, m: 1 }, now)).toBe(false);
  });
});

describe("isCurrentMonth", () => {
  const now = new Date(2026, 3, 25);

  it("returns true only for the same year and month", () => {
    expect(isCurrentMonth({ y: 2026, m: 4 }, now)).toBe(true);
  });

  it("returns false for different month in same year", () => {
    expect(isCurrentMonth({ y: 2026, m: 5 }, now)).toBe(false);
    expect(isCurrentMonth({ y: 2026, m: 3 }, now)).toBe(false);
  });

  it("returns false for same month different year", () => {
    expect(isCurrentMonth({ y: 2027, m: 4 }, now)).toBe(false);
  });
});

describe("pivotSchedulesToCells", () => {
  const now = new Date(2026, 3, 25); // 2026-04-25
  const monthYears = [
    { y: 2026, m: 3 },
    { y: 2026, m: 4 },
    { y: 2026, m: 5 },
  ];

  function makeSchedule(
    overrides: Partial<NouzeiScheduleWithItems> = {},
  ): NouzeiScheduleWithItems {
    return {
      id: "sched-1",
      company_id: "hyuaran",
      kind: "yotei",
      label: "予定",
      year: 2026,
      month: 4,
      due_date: "2026-04-30",
      total_amount: 1_000_000,
      status: "pending",
      paid_at: null,
      notes: null,
      created_at: "2026-04-01T00:00:00Z",
      updated_at: "2026-04-01T00:00:00Z",
      items: [],
      ...overrides,
    };
  }

  it("returns one cell per monthYear with empty pills when no schedules match", () => {
    const result = pivotSchedulesToCells([], monthYears, "hyuaran", now);
    expect(result).toHaveLength(3);
    expect(result.every((c) => c.pills.length === 0)).toBe(true);
  });

  it("filters schedules by companyId", () => {
    const result = pivotSchedulesToCells(
      [
        makeSchedule({ company_id: "hyuaran" }),
        makeSchedule({ id: "s2", company_id: "centerrise" }),
      ],
      monthYears,
      "hyuaran",
      now,
    );
    const aprilCell = result.find((c) => c.month.m === 4);
    expect(aprilCell?.pills).toHaveLength(1);
    expect(aprilCell?.pills[0].scheduleId).toBe("sched-1");
  });

  it("marks isPaid=true when schedule status is paid", () => {
    const result = pivotSchedulesToCells(
      [makeSchedule({ status: "paid" })],
      monthYears,
      "hyuaran",
      now,
    );
    const aprilCell = result.find((c) => c.month.m === 4);
    expect(aprilCell?.pills[0].isPaid).toBe(true);
  });

  it("marks isPaid=true for past months even when status=pending", () => {
    const result = pivotSchedulesToCells(
      [makeSchedule({ month: 3, status: "pending" })],
      monthYears,
      "hyuaran",
      now,
    );
    const marchCell = result.find((c) => c.month.m === 3);
    expect(marchCell?.pills[0].isPaid).toBe(true);
  });

  it("keeps isPaid=false for future-month pending schedules", () => {
    const result = pivotSchedulesToCells(
      [makeSchedule({ month: 5, status: "pending" })],
      monthYears,
      "hyuaran",
      now,
    );
    const mayCell = result.find((c) => c.month.m === 5);
    expect(mayCell?.pills[0].isPaid).toBe(false);
  });

  it("places multiple schedules in the same cell when same month", () => {
    const result = pivotSchedulesToCells(
      [
        makeSchedule({ id: "s1", month: 4, kind: "yotei" }),
        makeSchedule({ id: "s2", month: 4, kind: "extra" }),
      ],
      monthYears,
      "hyuaran",
      now,
    );
    const aprilCell = result.find((c) => c.month.m === 4);
    expect(aprilCell?.pills).toHaveLength(2);
  });
});
