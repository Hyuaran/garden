import { describe, expect, it } from "vitest";
import { calculateAporanSheet } from "./aporan-sheet";
import type { JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriDayResult, KanriSheetGrid } from "./kanri-sheet";

function kanriGrid(targetDay: number | "定休日"): KanriSheetGrid {
  const days: KanriDayResult[] = Array.from({ length: 27 }, (_, index) => ({
    day: index === 14 ? targetDay : index + 1,
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
    weekday: "",
    all: { hours: 0, efficiency: null, total: 0 },
    teams: {},
  }));
  return {
    yearMonth: "2026-08",
    products: [],
    teams: ["宮永チーム", "小泉チーム", "石原チーム"],
    days,
    totals: {
      all: { hours: 0, efficiency: null, total: 0, points: 260.6, amount: 0, pointEfficiency: null, amountPerHour: null },
      teams: {
        宮永チーム: { hours: 0, efficiency: null, total: 0, points: 87.2, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
        小泉チーム: { hours: 0, efficiency: null, total: 0, points: 87.0, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
        石原チーム: { hours: 0, efficiency: null, total: 0, points: 86.4, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
      },
    },
    openRate: {},
    cellValues: {},
  };
}

function jissekiGrid(): JissekiSheetGrid {
  const rows = [
    { personName: "宮永　ひかり", kotName: "宮永 ひかり", wageLabel: "社員", department: "宮永チーム", team: "宮永チーム", landingHours: 215, workHours: 215, totalPoints: 43.3, efficiency: 43.3 / 215, workDays: 26, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
    { personName: "石原　孝志朗", kotName: "石原 孝志朗", wageLabel: "社員", department: "石原チーム", team: "石原チーム", landingHours: 208, workHours: 208, totalPoints: 36.9, efficiency: 36.9 / 208, workDays: 26, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
    { personName: "小泉　同点", kotName: "小泉 同点", wageLabel: 1400, department: "小泉チーム", team: "小泉チーム", landingHours: 100, workHours: 100, totalPoints: 36.9, efficiency: 0.369, workDays: 10, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
    { personName: "新人　ゼロ", kotName: "新人 ゼロ", wageLabel: 1200, department: "新人チーム", team: "新人チーム", landingHours: 0, workHours: 0, totalPoints: 0, efficiency: 0, workDays: 0, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
  ];
  return { yearMonth: "2026-08", products: [], productColumns: [], rows, missingCommuteNames: [], cellValues: {} };
}

describe("calculateAporanSheet", () => {
  it("calculates the current required points and landing points from the monthly target", () => {
    const grid = calculateAporanSheet({
      yearMonth: "2026-08",
      targetDate: "2026-08-15",
      kanriGrid: kanriGrid(13),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        monthlySettings: { aporanTargets: { all: 240, miyanaga: 80, koizumi: 80, ishihara: 80, newcomer: 0 } },
      },
    });

    expect(grid.teams.all.currentRequiredPoints).toBe(115.5);
    expect(grid.teams.all.achievementRate).toBeCloseTo(260.6 / 115.5);
    expect(grid.teams.all.landingPoints).toBe(541.5);
    expect(grid.teams.newcomer.actualPoints).toBeCloseTo(0);
    expect(grid.teams.newcomer.efficiency).toBeNull();
  });

  it("keeps rank ties stable and derives status from wage", () => {
    const grid = calculateAporanSheet({
      yearMonth: "2026-08",
      targetDate: "2026-09-01",
      kanriGrid: kanriGrid("定休日"),
      jissekiGrid: jissekiGrid(),
      manualInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
    });

    expect(grid.teams.all.currentRequiredPoints).toBeNull();
    expect(grid.cellValues.D7).toBeNull();
    expect(grid.ranking.map((row) => [row.rank, row.personName, row.status])).toEqual([
      [1, "宮永　ひかり", "社員"],
      [2, "石原　孝志朗", "社員"],
      [3, "小泉　同点", "ゴールド"],
      [4, "新人　ゼロ", null],
    ]);
    expect(grid.ranking[0].displayEfficiency).toBe(0.2);
    expect(grid.cellValues.I21).toBe(0.2);
  });
});
