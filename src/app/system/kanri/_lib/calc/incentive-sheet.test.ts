import { describe, expect, it } from "vitest";
import type { AporanSheetGrid } from "./aporan-sheet";
import { calculateIncentiveSheet } from "./incentive-sheet";
import type { JissekiSheetGrid } from "./jisseki-sheet";
import type { KanriDayResult, KanriSheetGrid } from "./kanri-sheet";

function kanriGrid(): KanriSheetGrid {
  const days: KanriDayResult[] = Array.from({ length: 31 }, (_, index) => ({
    day: [6, 13, 20, 27].includes(index + 1) ? "定休日" : index + 1,
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
      all: { hours: 0, efficiency: null, total: 0, points: 600, amount: 0, pointEfficiency: null, amountPerHour: null },
      teams: {},
    },
    openRate: {},
    cellValues: {},
  };
}

function aporanGrid(miyanagaPoints = 320, koizumiPoints = 280, allLandingHours = 2966): AporanSheetGrid {
  const team = (key: "all" | "miyanaga" | "koizumi" | "ishihara" | "newcomer", label: string, actualPoints: number, landingHours: number) => ({
    key,
    label,
    actualPoints,
    targetPoints: 0,
    currentRequiredPoints: null,
    workHours: landingHours,
    landingHours,
    efficiency: landingHours === 0 ? null : actualPoints / landingHours,
    landingPoints: null,
    achievementRate: null,
  });
  return {
    yearMonth: "2026-08",
    targetDate: "2026-08-31",
    teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
    teams: {
      all: team("all", "テレマ全体", miyanagaPoints + koizumiPoints, allLandingHours),
      miyanaga: team("miyanaga", "宮永チーム", miyanagaPoints, 971.5),
      koizumi: team("koizumi", "小泉チーム", koizumiPoints, 968.5),
      ishihara: team("ishihara", "石原チーム", 0, 0),
      newcomer: team("newcomer", "新人チーム", 0, 0),
    },
    ranking: [],
    cellValues: {},
  };
}

function jissekiGrid(): JissekiSheetGrid {
  return {
    yearMonth: "2026-08",
    products: [],
    productColumns: [],
    rows: [
      { personName: "宮永　ひかり", kotName: "宮永 ひかり", wageLabel: "社員", department: "宮永チーム", team: "宮永チーム", landingHours: 215, workHours: 215, totalPoints: 43.3, efficiency: 43.3 / 215, workDays: 26, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
      { personName: "小泉　翔", kotName: "小泉 翔", wageLabel: "社員", department: "小泉チーム", team: "小泉チーム", landingHours: 211, workHours: 211, totalPoints: 33.8, efficiency: 33.8 / 211, workDays: 26, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
      { personName: "小泉　別人", kotName: "小泉 別人", wageLabel: 1400, department: "小泉チーム", team: "小泉チーム", landingHours: 100, workHours: 100, totalPoints: 99, efficiency: 0.99, workDays: 10, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
    ],
    missingCommuteNames: [],
    cellValues: {},
  };
}

describe("calculateIncentiveSheet", () => {
  it("calculates payouts from monthly incentive settings", () => {
    const grid = calculateIncentiveSheet({
      yearMonth: "2026-08",
      kanriGrid: kanriGrid(),
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        monthlySettings: { incentive: { targetPoints: 300, achievementBonusTotal: 192000, teamVictoryBonus: 50000 } },
      },
    });

    expect(grid.teams.miyanaga.achievementRate).toBeCloseTo(320 / 300);
    expect(grid.teams.miyanaga.achievementPayout).toBe(96000);
    expect(grid.teams.miyanaga.teamVictoryBonus).toBe(50000);
    expect(grid.teams.miyanaga.targetOverBonus).toBe(10000);
    expect(grid.teams.miyanaga.totalIncentive).toBe(156000);
    expect(grid.teams.koizumi.achievementPayout).toBe(0);
    expect(grid.teams.koizumi.teamVictoryBonus).toBe(0);
    expect(grid.teams.koizumi.totalIncentive).toBe(0);
    expect(grid.cellValues.C16).toBe(2966);
    expect(grid.cellValues.D16).toBeCloseTo(300 / 2966);
  });

  it("pays both teams when achievement rates are tied", () => {
    const grid = calculateIncentiveSheet({
      yearMonth: "2026-08",
      kanriGrid: kanriGrid(),
      aporanGrid: aporanGrid(300, 300),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        monthlySettings: { incentive: { targetPoints: 300, achievementBonusTotal: 192000, teamVictoryBonus: 50000 } },
      },
    });

    expect(grid.teams.miyanaga.teamVictoryBonus).toBe(50000);
    expect(grid.teams.koizumi.teamVictoryBonus).toBe(50000);
  });

  it("keeps missing manual settings as null", () => {
    const grid = calculateIncentiveSheet({
      yearMonth: "2026-08",
      kanriGrid: kanriGrid(),
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {}, monthlySettings: { incentive: {} } },
    });

    expect(grid.teams.miyanaga.targetPoints).toBeNull();
    expect(grid.teams.miyanaga.achievementRate).toBeNull();
    expect(grid.teams.miyanaga.totalIncentive).toBeNull();
    expect(grid.overall.perPersonAchievementBonus).toBeNull();
  });

  it("rounds down target-over bonus to thousands before splitting", () => {
    const grid = calculateIncentiveSheet({
      yearMonth: "2026-08",
      kanriGrid: kanriGrid(),
      aporanGrid: aporanGrid(320.9, 300),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        monthlySettings: { incentive: { targetPoints: 300, achievementBonusTotal: 192000, teamVictoryBonus: 50000 } },
      },
    });

    expect(grid.teams.miyanaga.targetOverBonus).toBe(10000);
  });
});
