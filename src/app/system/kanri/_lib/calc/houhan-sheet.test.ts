import { describe, expect, it } from "vitest";
import type { KanriSourceRow } from "../kanri-core";
import { calculateHouhanSheet, HOUHAN_PRODUCTS } from "./houhan-sheet";
import type { KanriPerson } from "./jisseki-sheet";

const people: KanriPerson[] = [
  { name: "訪販　太郎", kot_name: "訪販 太郎", team: "訪問営業", department: "関電", employment_kind: "社員", base_wage: null, is_field_sales: true, sort_order: 10 },
];

function row(recordId: string, payload: Record<string, unknown>): KanriSourceRow {
  return { source: "kanden_report", sourceApp: null, recordId, payload };
}

describe("calculateHouhanSheet", () => {
  it("handles work, holiday, zero, and empty statuses", () => {
    const grid = calculateHouhanSheet({
      yearMonth: "2026-08",
      people,
      sourceRows: [
        row("1", { staff_name: "訪販太郎", work_date: "2026-08-01", report_time: "最終", 奪還_なっとくプラン_なっとく電気: "2" }),
      ],
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        fieldSales: {
          weights: { 奪還_なっとくプラン_なっとく電気: 0.5 },
          byPerson: {
            "訪販　太郎": {
              days: {
                "2026-08-01": { status: "出勤", hours: 7 },
                "2026-08-02": { status: "公休" },
                "2026-08-03": { status: "ゼロ", hours: 7 },
                "2026-08-04": { status: "" },
              },
            },
          },
        },
      },
    });

    const days = grid.people[0].days;
    expect(days[0].products["奪還_なっとくプラン_なっとく電気"]).toBe(2);
    expect(days[0].personalPoints).toBe(1);
    expect(days[1].personalPoints).toBeNull();
    expect(days[2].actualCount).toBe(0);
    expect(days[3].actualCount).toBe(0);
    expect(grid.people[0].totals.hours).toBe(14);
  });

  it("normalizes name spaces and uses the largest record id when final reports are duplicated", () => {
    const grid = calculateHouhanSheet({
      yearMonth: "2026-08",
      people,
      sourceRows: [
        row("3", { staff_name: "訪販太郎", work_date: "2026-08-01", report_time: "最終", 奪還_なっとくプラン_なっとく電気: "1" }),
        row("9", { staff_name: "訪販 太郎", work_date: "2026-08-01", report_time: "最終", 奪還_なっとくプラン_なっとく電気: "4" }),
        row("10", { staff_name: "訪販太郎", work_date: "2026-08-01", report_time: "朝", 奪還_なっとくプラン_なっとく電気: "8" }),
      ],
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        fieldSales: { byPerson: { "訪販　太郎": { days: { "2026-08-01": { status: "出勤" } } } } },
      },
    });

    expect(grid.people[0].days[0].products["奪還_なっとくプラン_なっとく電気"]).toBe(4);
    expect(grid.people[0].days[0].hours).toBe(7);
  });

  it("applies saved coefficients and manual breaker counts", () => {
    const grid = calculateHouhanSheet({
      yearMonth: "2026-08",
      people,
      sourceRows: [],
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        fieldSales: {
          weights: { レンタル: 2, 販売: 20 },
          byPerson: { "訪販　太郎": { days: { "2026-08-01": { status: "出勤", rental: 3, sales: 2 } } } },
        },
      },
    });

    expect(HOUHAN_PRODUCTS).toHaveLength(15);
    expect(grid.people[0].days[0].personalPoints).toBe(46);
    expect(grid.people[0].totals.pointsByProduct.レンタル).toBe(6);
    expect(grid.people[0].totals.pointsByProduct.販売).toBe(40);
    expect(grid.people[0].days[0].missingReport).toBe(true);
  });
});
