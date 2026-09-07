import { describe, expect, it } from "vitest";
import type { KanriSourceRow } from "../kanri-core";
import { calculateJissekiSheet, normalizeCommuteMap, type KanriPerson } from "./jisseki-sheet";
import type { KanriPointMaster } from "./kanri-sheet";

const points: KanriPointMaster[] = [
  { product: "光A", kintone_names: ["光A別名"], category: "hikari", coefficient: 1.2, unit_price: 100, sort_order: 10 },
  { product: "カードA", kintone_names: ["カードA別名"], category: "credit", coefficient: 0.5, unit_price: 100, sort_order: 20 },
  { product: "電気A", kintone_names: ["電気A別名"], category: "electric", coefficient: 0.8, unit_price: 100, sort_order: 30 },
];

const people: KanriPerson[] = [
  { name: "山田　花子", kot_name: "山田 花子", team: "宮永チーム", department: "宮永チーム", employment_kind: "アルバイト", base_wage: 1400, is_field_sales: false, sort_order: 10 },
  { name: "訪販　太郎", kot_name: "訪販 太郎", team: "訪問営業", department: "関電", employment_kind: "社員", base_wage: null, is_field_sales: true, sort_order: 20 },
  { name: "交通費　なし", kot_name: "交通費 なし", team: "小泉チーム", department: "小泉チーム", employment_kind: "派遣", base_wage: null, is_field_sales: false, sort_order: 30 },
];

function row(source: "kintone_customer" | "credit_card", payload: Record<string, unknown>): KanriSourceRow {
  return { source, sourceApp: null, recordId: Math.random().toString(), payload };
}

describe("calculateJissekiSheet", () => {
  it("splits toss and AP, applies hikari AP coefficient minus 0.2, and counts credit/electric by their own rule", () => {
    const grid = calculateJissekiSheet({
      yearMonth: "2026-08",
      points,
      people,
      commuteByName: normalizeCommuteMap([{ name: "山田 花子", commute_daily_allowance: 900 }]),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        personMonthly: { "山田　花子": { landingHours: 20, workHours: 10, workDays: 2 } },
      },
      sourceRows: [
        row("kintone_customer", { 実績日: "2026-08-01", 商材名区分2: "光A別名", トス名: "山田 花子", AP名: "山田　花子" }),
        row("kintone_customer", { 実績日: "2026-08-02", 商材名区分2: "電気A別名", トス名: "山田　花子", AP名: "別の人" }),
        row("credit_card", { ドロップダウン_12: "カードA別名", AP名: "山田 花子" }),
      ],
    });

    const rowResult = grid.rows[0];
    expect(grid.productColumns.map((column) => column.label)).toEqual(["光A トス", "AP", "カードA", "電気A"]);
    expect(rowResult.counts).toMatchObject({ "光A:toss": 1, "光A:ap": 1, "カードA:single": 1, "電気A:single": 1 });
    expect(rowResult.totalPoints).toBeCloseTo(0.2 + 1.0 + 0.5 + 0.8);
    expect(rowResult.efficiency).toBeCloseTo(0.25);
    expect(rowResult.commuteDailyAllowance).toBe(900);
  });

  it("uses manual field sales points and zeros product counts for field sales people", () => {
    const grid = calculateJissekiSheet({
      yearMonth: "2026-08",
      points,
      people,
      commuteByName: {},
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        personMonthly: { "訪販　太郎": { workHours: 8, fieldPoints: 27.6 } },
      },
      sourceRows: [
        row("kintone_customer", { 実績日: "2026-08-01", 商材名区分2: "光A別名", トス名: "訪販 太郎", AP名: "訪販 太郎" }),
      ],
    });

    expect(grid.rows[1].totalPoints).toBe(27.6);
    expect(Object.values(grid.rows[1].counts).every((count) => count === 0)).toBe(true);
    expect(grid.missingCommuteNames).toContain("訪販　太郎");
  });
});
