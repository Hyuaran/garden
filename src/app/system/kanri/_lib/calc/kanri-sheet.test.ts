import { describe, expect, it } from "vitest";
import { calculateKanriSheet, type KanriPointMaster, type KanriTeamMaster } from "./kanri-sheet";
import type { KanriSourceRow } from "../kanri-core";

const points: KanriPointMaster[] = [
  { product: "AU光", kintone_names: ["au光　Sonet", "au光　BIGLOBE"], category: "hikari", coefficient: 1.6, unit_price: 84180, sort_order: 20 },
  { product: "BIGLOBE光", kintone_names: ["BIGLOBE光"], category: "hikari", coefficient: 1.2, unit_price: 41000, sort_order: 10 },
];

const teams: KanriTeamMaster[] = [
  { team: "宮永チーム", sort_order: 10 },
  { team: "小泉チーム", sort_order: 20 },
];

function source(source: "kintone_customer" | "credit_card", payload: Record<string, unknown>): KanriSourceRow {
  return { source, sourceApp: null, recordId: Math.random().toString(), payload };
}

describe("calculateKanriSheet", () => {
  it("uses point master order and bundles kintone aliases", () => {
    const grid = calculateKanriSheet({
      yearMonth: "2026-08",
      holidays: [],
      points,
      teams,
      sourceRows: [
        source("kintone_customer", { 実績日: "2026-08-01T00:00:00", チーム名: "宮永チーム", 商材名区分2: "au光　Sonet" }),
        source("kintone_customer", { 実績日: "2026-08-01T00:00:00", チーム名: "宮永チーム", 商材名区分2: "au光　BIGLOBE" }),
        source("kintone_customer", { 実績日: "2026-08-01T00:00:00", チーム名: "宮永チーム", 商材名区分2: "BIGLOBE光" }),
      ],
      manualInputs: {
        hoursByTeamByDate: { 宮永チーム: { "2026-08-01": 6 } },
        openRateByTeamByProduct: { 宮永チーム: { AU光: 0.7, BIGLOBE光: 0.84 } },
      },
    });

    expect(grid.products).toEqual(["BIGLOBE光", "AU光"]);
    expect(grid.days[0].teams["宮永チーム"].products).toEqual({ BIGLOBE光: 1, AU光: 2 });
    expect(grid.cellValues.L8).toBe(1);
    expect(grid.cellValues.M8).toBe(2);
  });

  it("keeps holidays at zero and leaves efficiency null", () => {
    const grid = calculateKanriSheet({
      yearMonth: "2026-08",
      holidays: ["2026-08-01"],
      points,
      teams,
      sourceRows: [
        source("kintone_customer", { 実績日: "2026-08-01T00:00:00", チーム名: "宮永チーム", 商材名区分2: "BIGLOBE光" }),
      ],
      manualInputs: {
        hoursByTeamByDate: { 宮永チーム: { "2026-08-01": 6 } },
        openRateByTeamByProduct: { 宮永チーム: { BIGLOBE光: 0.84 } },
      },
    });

    expect(grid.days[0].day).toBe("定休日");
    expect(grid.days[0].all).toEqual({ hours: 0, efficiency: null, total: 0 });
    expect(grid.days[0].teams["宮永チーム"].efficiency).toBeNull();
  });
});
