import { describe, expect, it } from "vitest";
import type { AporanSheetGrid } from "./aporan-sheet";
import type { JissekiSheetGrid } from "./jisseki-sheet";
import { calculatePayrollSheet } from "./payroll-sheet";

function aporanGrid(): AporanSheetGrid {
  return {
    yearMonth: "2026-08",
    targetDate: "2026-08-31",
    teamOrder: ["all", "miyanaga", "koizumi", "ishihara", "newcomer"],
    teams: {} as AporanSheetGrid["teams"],
    ranking: [
      { rank: 1, department: "A", personName: "A", status: "社員", wageLabel: "社員", totalPoints: 43.3, workHours: 215, efficiency: 0.201, displayEfficiency: 0.2, landingHours: 215, digitalLanding: 43.3 },
      { rank: 2, department: "B", personName: "B", status: "ゴールド", wageLabel: 1400, totalPoints: 19.9, workHours: 100, efficiency: 0.199, displayEfficiency: 0.19, landingHours: 100, digitalLanding: 19.9 },
      { rank: 6, department: "C", personName: "C", status: "プラチナ", wageLabel: 1600, totalPoints: 50, workHours: 120, efficiency: 0.416, displayEfficiency: 0.41, landingHours: 120, digitalLanding: 50 },
    ],
    cellValues: {},
  };
}

function jissekiGrid(): JissekiSheetGrid {
  return {
    yearMonth: "2026-08",
    products: [],
    productColumns: [],
    rows: [
      { personName: "A", kotName: "A", wageLabel: "社員", department: "A", team: "A", landingHours: 215, workHours: 215, totalPoints: 43.3, efficiency: 0.201, workDays: 26, commuteDailyAllowance: 580, missingCommute: false, counts: {} },
      { personName: "B", kotName: "B", wageLabel: 1400, department: "B", team: "B", landingHours: 100, workHours: 100, totalPoints: 19.9, efficiency: 0.199, workDays: 10, commuteDailyAllowance: 300, missingCommute: false, counts: {} },
      { personName: "C", kotName: "C", wageLabel: 1600, department: "C", team: "C", landingHours: 120, workHours: 120, totalPoints: 50, efficiency: 0.416, workDays: 12, commuteDailyAllowance: 0, missingCommute: false, counts: {} },
    ],
    missingCommuteNames: [],
    cellValues: {},
  };
}

describe("calculatePayrollSheet", () => {
  it("keeps next wage and AP fields null when current wage is text", () => {
    const grid = calculatePayrollSheet({
      yearMonth: "2026-08",
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {}, payrollByPerson: { A: { wageAdjustment: 100 } } },
    });

    expect(grid.rows[0].nextWage).toBeNull();
    expect(grid.rows[0].apHourlyWage).toBeNull();
    expect(grid.rows[0].apIncentive).toBeNull();
    expect(grid.rows[0].totalPayout).toBeNull();
  });

  it("calculates awards from rank and total points thresholds", () => {
    const grid = calculatePayrollSheet({
      yearMonth: "2026-08",
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        payrollByPerson: {
          B: { referralPoints: 0.1 },
          C: { referralPoints: 10 },
        },
      },
    });

    expect(grid.rows[1].presidentAward).toBe(30000);
    expect(grid.rows[1].pointAward).toBe(5000);
    expect(grid.rows[2].presidentAward).toBe(0);
    expect(grid.rows[2].pointAward).toBe(60000);
  });

  it("uses Garden payout formula with training allowance and extra incentives", () => {
    const grid = calculatePayrollSheet({
      yearMonth: "2026-08",
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: {
        hoursByTeamByDate: {},
        openRateByTeamByProduct: {},
        monthlySettings: { payroll: { baseWage: 1177, trainingWage: 1500 } },
        payrollByPerson: {
          B: { wageAdjustment: 100, trainingHours: 2, hiringBonus: 1000, talentReferralIncentive: 2000, dealIncentive: 3000 },
        },
      },
    });

    const row = grid.rows[1];
    expect(row.scheduledHours).toBe(98);
    expect(row.basePay).toBe(1177 * 98);
    expect(row.apIncentive).toBe((1500 - 1177) * 98);
    expect(row.trainingAllowance).toBe(3000);
    expect(row.totalPayout).toBe((1177 * 98) + ((1500 - 1177) * 98) + 3000 + 30000 + 0 + 1000 + 2000 + 3000);
  });

  it("calculates period dates from the target month", () => {
    const grid = calculatePayrollSheet({
      yearMonth: "2026-08",
      aporanGrid: aporanGrid(),
      jissekiGrid: jissekiGrid(),
      manualInputs: { hoursByTeamByDate: {}, openRateByTeamByProduct: {} },
    });

    expect(grid.period).toEqual({ start: "2026-08-01", end: "2026-08-31", scheduledPayDate: "2026-09-30" });
    expect(grid.cellValues.AB24).toBe("2026-08-01");
    expect(grid.cellValues.AD24).toBe("2026-09-30");
  });
});
