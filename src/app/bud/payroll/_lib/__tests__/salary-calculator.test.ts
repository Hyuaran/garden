/**
 * D-02 給与計算 計算ロジック 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md
 *
 * 網羅項目:
 *   1. calculateMonthlyBasicPay（按分なし / 按分あり / 境界）
 *   2. calculateHourlyBasicPay
 *   3. calculateBaseHourlyRate（時給単価）
 *   4. calculateOvertime（25% / 60h 超 50% / 深夜 / 法定休日 / 法定外休日）
 *   5. calculateAbsentLateDeduction
 *   6. calculateMonthlySalary（月給制統合 / 時給制 / 業務委託）
 *   7. lookupWithholdingTax（甲: 0-7 人 / 7 人超 / 範囲外、乙: flat + rate）
 *   8. calculateTaxableAmount（非課税通勤手当 + 社保控除）
 *   9. decideResidentTax（6 月 / 7-5 月 / fiscal_year 整合性）
 *   10. filterEffectiveAtDate
 *   11. calculateNetPay
 */

import { describe, it, expect } from "vitest";
import {
  calculateMonthlyBasicPay,
  calculateHourlyBasicPay,
  calculateBaseHourlyRate,
  calculateOvertime,
  calculateAbsentLateDeduction,
  calculateMonthlySalary,
  lookupWithholdingTax,
  calculateTaxableAmount,
  decideResidentTax,
  filterEffectiveAtDate,
  calculateNetPay,
} from "../salary-calculator";
import type {
  WithholdingTaxTableKouRow,
  WithholdingTaxTableOtsuRow,
  BudResidentTaxAssignment,
  AllowanceBreakdown,
} from "../salary-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildKouTable(): WithholdingTaxTableKouRow[] {
  // サンプル 3 行（実際は数百行、計算ロジック検証用に最小限）
  return [
    {
      id: "kou-1",
      effectiveYear: 2026,
      taxableMin: 0,
      taxableMax: 88_000,
      dependents0: 0,
      dependents1: 0,
      dependents2: 0,
      dependents3: 0,
      dependents4: 0,
      dependents5: 0,
      dependents6: 0,
      dependents7: 0,
    },
    {
      id: "kou-2",
      effectiveYear: 2026,
      taxableMin: 250_000,
      taxableMax: 253_000,
      dependents0: 6_750,
      dependents1: 5_120,
      dependents2: 3_500,
      dependents3: 1_870,
      dependents4: 240,
      dependents5: 0,
      dependents6: 0,
      dependents7: 0,
    },
    {
      id: "kou-3",
      effectiveYear: 2026,
      taxableMin: 1_000_000,
      taxableMax: 1_005_000,
      dependents0: 200_000,
      dependents1: 195_000,
      dependents2: 190_000,
      dependents3: 185_000,
      dependents4: 180_000,
      dependents5: 175_000,
      dependents6: 170_000,
      dependents7: 165_000,
    },
  ];
}

function buildOtsuTable(): WithholdingTaxTableOtsuRow[] {
  return [
    {
      id: "otsu-1",
      effectiveYear: 2026,
      taxableMin: 0,
      taxableMax: 88_000,
      taxRate: 0.0306,
      flatAmount: 0,
    },
    {
      id: "otsu-2",
      effectiveYear: 2026,
      taxableMin: 250_000,
      taxableMax: 253_000,
      taxRate: 0.1063,
      flatAmount: 25_000,
    },
  ];
}

function emptyAllowances(): AllowanceBreakdown {
  return {
    commute: 0,
    housing: 0,
    position: 0,
    family: 0,
    qualification: 0,
    custom: {},
    total: 0,
  };
}

// ============================================================
// 1. calculateMonthlyBasicPay
// ============================================================

describe("calculateMonthlyBasicPay", () => {
  it("フル出勤 → 月給そのまま", () => {
    expect(calculateMonthlyBasicPay(300_000, 22, 22)).toBe(300_000);
  });

  it("出勤超過 → 月給そのまま（按分なし）", () => {
    expect(calculateMonthlyBasicPay(300_000, 25, 22)).toBe(300_000);
  });

  it("半月出勤 → 半額（floor）", () => {
    expect(calculateMonthlyBasicPay(300_000, 11, 22)).toBe(150_000);
  });

  it("3 日出勤 / 22 日所定 → 按分（floor）", () => {
    // 300_000 × 3 / 22 = 40909.09 → floor = 40909
    expect(calculateMonthlyBasicPay(300_000, 3, 22)).toBe(40_909);
  });

  it("出勤 0 日 → 0", () => {
    expect(calculateMonthlyBasicPay(300_000, 0, 22)).toBe(0);
  });

  it("月所定 0 日（不正データ）→ 0", () => {
    expect(calculateMonthlyBasicPay(300_000, 22, 0)).toBe(0);
  });
});

// ============================================================
// 2. calculateHourlyBasicPay
// ============================================================

describe("calculateHourlyBasicPay", () => {
  it("時給 1200 × 8h = 9600", () => {
    expect(calculateHourlyBasicPay(1200, 480)).toBe(9_600);
  });

  it("時給 0 → 0", () => {
    expect(calculateHourlyBasicPay(0, 480)).toBe(0);
  });

  it("実労働 0 分 → 0", () => {
    expect(calculateHourlyBasicPay(1200, 0)).toBe(0);
  });

  it("実労働 90 分（1.5h）, 時給 1200 → 1800", () => {
    expect(calculateHourlyBasicPay(1200, 90)).toBe(1_800);
  });

  it("端数: 時給 1234 × 30 分 = 617（floor）", () => {
    // 1234 × 30 / 60 = 617
    expect(calculateHourlyBasicPay(1234, 30)).toBe(617);
  });
});

// ============================================================
// 3. calculateBaseHourlyRate
// ============================================================

describe("calculateBaseHourlyRate", () => {
  it("月給 30 万 / 月所定 10000 分 → 1800 円/h", () => {
    // 300_000 × 60 / 10000 = 1800
    expect(calculateBaseHourlyRate(300_000, 10_000)).toBe(1_800);
  });

  it("月所定 0 → 0（除算回避）", () => {
    expect(calculateBaseHourlyRate(300_000, 0)).toBe(0);
  });
});

// ============================================================
// 4. calculateOvertime
// ============================================================

describe("calculateOvertime", () => {
  it("残業 60h ちょうど → 通常残業のみ（0 超過分）", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 60 * 60,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
    });
    // 通常 = 2000 × 60 × 1.25 = 150_000
    expect(result.regularOvertimePay).toBe(150_000);
    expect(result.excessOvertimePay).toBe(0);
  });

  it("残業 80h → 60h 通常 + 20h 超過", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 80 * 60,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
    });
    // 通常 = 2000 × 60 × 1.25 = 150_000
    // 超過 = 2000 × 20 × 1.5 = 60_000
    expect(result.regularOvertimePay).toBe(150_000);
    expect(result.excessOvertimePay).toBe(60_000);
  });

  it("深夜労働 30h → 25% 上乗せ", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 0,
      lateNightMinutes: 30 * 60,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
    });
    // 2000 × 30 × 1.25 = 75_000
    expect(result.lateNightPay).toBe(75_000);
  });

  it("法定休日労働 8h → 35% 上乗せ", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 8 * 60,
      legalOvertimeMinutes: 0,
    });
    // 2000 × 8 × 1.35 = 21_600
    expect(result.holidayPay).toBe(21_600);
  });

  it("法定外休日労働 8h → 25% 上乗せ", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 8 * 60,
    });
    expect(result.legalOvertimePay).toBe(20_000);
  });

  it("全部ゼロ → 全部ゼロ", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
    });
    expect(result.total).toBe(0);
  });

  it("複合: 残業 80h + 深夜 10h + 法定休日 8h + 法定外休日 8h", () => {
    const result = calculateOvertime(2000, {
      overtimeMinutes: 80 * 60,
      lateNightMinutes: 10 * 60,
      holidayWorkingMinutes: 8 * 60,
      legalOvertimeMinutes: 8 * 60,
    });
    expect(result.regularOvertimePay).toBe(150_000);
    expect(result.excessOvertimePay).toBe(60_000);
    expect(result.lateNightPay).toBe(25_000); // 2000 × 10 × 1.25
    expect(result.holidayPay).toBe(21_600);
    expect(result.legalOvertimePay).toBe(20_000);
    expect(result.total).toBe(150_000 + 60_000 + 25_000 + 21_600 + 20_000);
  });
});

// ============================================================
// 5. calculateAbsentLateDeduction
// ============================================================

describe("calculateAbsentLateDeduction", () => {
  it("欠勤 0、遅刻 0 → 全部 0", () => {
    const r = calculateAbsentLateDeduction({
      monthlyBasePay: 300_000,
      calendarDays: 30,
      monthlyScheduledMinutes: 10_000,
      absentDays: 0,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
    });
    expect(r.total).toBe(0);
  });

  it("欠勤 1 日（暦 30 日）→ 月給 / 30 控除", () => {
    const r = calculateAbsentLateDeduction({
      monthlyBasePay: 300_000,
      calendarDays: 30,
      monthlyScheduledMinutes: 10_000,
      absentDays: 1,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
    });
    expect(r.absentDeduction).toBe(10_000);
  });

  it("遅刻 60 分（月所定 10000 分）→ 月給 × 60 / 10000 控除", () => {
    const r = calculateAbsentLateDeduction({
      monthlyBasePay: 300_000,
      calendarDays: 30,
      monthlyScheduledMinutes: 10_000,
      absentDays: 0,
      lateMinutesTotal: 60,
      earlyLeaveMinutesTotal: 0,
    });
    // 300_000 × 60 / 10000 = 1800
    expect(r.lateDeduction).toBe(1_800);
  });

  it("早退 30 分", () => {
    const r = calculateAbsentLateDeduction({
      monthlyBasePay: 300_000,
      calendarDays: 30,
      monthlyScheduledMinutes: 10_000,
      absentDays: 0,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 30,
    });
    expect(r.earlyLeaveDeduction).toBe(900);
  });

  it("不正値: 暦 0 日 → 欠勤控除 0", () => {
    const r = calculateAbsentLateDeduction({
      monthlyBasePay: 300_000,
      calendarDays: 0,
      monthlyScheduledMinutes: 10_000,
      absentDays: 5,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
    });
    expect(r.absentDeduction).toBe(0);
  });
});

// ============================================================
// 6. calculateMonthlySalary（統合）
// ============================================================

describe("calculateMonthlySalary - 月給制", () => {
  it("基本給のみ、残業 0、手当 0、欠勤 0", () => {
    const r = calculateMonthlySalary({
      baseCalculationMethod: "monthly",
      monthlyBasePay: 300_000,
      hourlyRate: null,
      monthlyScheduledMinutes: 10_000,
      calendarDays: 30,
      workingDays: 22,
      actualWorkingMinutes: 10_000,
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
      absentDays: 0,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
      allowances: emptyAllowances(),
    });
    expect(r.basicPay).toBe(300_000);
    expect(r.grossPay).toBe(300_000);
  });

  it("基本給 + 残業 30h + 手当 5 万 + 欠勤 1 日", () => {
    const r = calculateMonthlySalary({
      baseCalculationMethod: "monthly",
      monthlyBasePay: 300_000,
      hourlyRate: null,
      monthlyScheduledMinutes: 10_000,
      calendarDays: 30,
      workingDays: 21,
      actualWorkingMinutes: 9_500,
      overtimeMinutes: 30 * 60,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
      absentDays: 1,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
      allowances: { ...emptyAllowances(), commute: 30_000, housing: 20_000, total: 50_000 },
    });

    // 単価 = 300_000 × 60 / 10000 = 1800
    // 残業 = 1800 × 30 × 1.25 = 67_500
    // 欠勤 = 300_000 × 1 / 30 = 10_000
    // grossPay = 300_000 + 67_500 + 50_000 - 10_000 = 407_500
    expect(r.basicPay).toBe(300_000);
    expect(r.overtime.regularOvertimePay).toBe(67_500);
    expect(r.absentLate.absentDeduction).toBe(10_000);
    expect(r.grossPay).toBe(407_500);
  });
});

describe("calculateMonthlySalary - 時給制", () => {
  it("時給 1200 × 8h × 22 日 = 211200、残業 0", () => {
    const r = calculateMonthlySalary({
      baseCalculationMethod: "hourly",
      monthlyBasePay: 0,
      hourlyRate: 1200,
      monthlyScheduledMinutes: 0,
      calendarDays: 30,
      workingDays: 22,
      actualWorkingMinutes: 22 * 8 * 60,
      overtimeMinutes: 0,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
      absentDays: 0,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
      allowances: emptyAllowances(),
    });
    // 時給 1200 × 22 × 8 × 60 / 60 = 211_200
    expect(r.basicPay).toBe(211_200);
    expect(r.absentLate.total).toBe(0); // 時給制は欠勤控除なし
    expect(r.grossPay).toBe(211_200);
  });
});

describe("calculateMonthlySalary - 業務委託", () => {
  it("commission → 全部 0（給与計算対象外）", () => {
    const r = calculateMonthlySalary({
      baseCalculationMethod: "commission",
      monthlyBasePay: 100_000,
      hourlyRate: null,
      monthlyScheduledMinutes: 10_000,
      calendarDays: 30,
      workingDays: 22,
      actualWorkingMinutes: 10_000,
      overtimeMinutes: 60 * 60,
      lateNightMinutes: 0,
      holidayWorkingMinutes: 0,
      legalOvertimeMinutes: 0,
      absentDays: 0,
      lateMinutesTotal: 0,
      earlyLeaveMinutesTotal: 0,
      allowances: { ...emptyAllowances(), commute: 50_000, total: 50_000 },
    });
    expect(r.basicPay).toBe(0);
    expect(r.grossPay).toBe(0);
  });
});

// ============================================================
// 7. lookupWithholdingTax
// ============================================================

describe("lookupWithholdingTax - 甲欄", () => {
  const kouTable = buildKouTable();
  const otsuTable = buildOtsuTable();

  it("課税 251000 + 扶養 0 人 → 6750", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 251_000,
      kouOtsu: "kou",
      dependentsCount: 0,
      kouTable,
      otsuTable,
    });
    expect(result).toBe(6_750);
  });

  it("課税 251000 + 扶養 3 人 → 1870", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 251_000,
      kouOtsu: "kou",
      dependentsCount: 3,
      kouTable,
      otsuTable,
    });
    expect(result).toBe(1_870);
  });

  it("扶養 8 人 → dependents_7 - 1610（範囲: 高所得テーブル使用）", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 1_002_000,
      kouOtsu: "kou",
      dependentsCount: 8,
      kouTable,
      otsuTable,
    });
    // dependents_7 = 165_000、減算 = 1610
    expect(result).toBe(163_390);
  });

  it("扶養 10 人（7 人超 3 人）", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 1_002_000,
      kouOtsu: "kou",
      dependentsCount: 10,
      kouTable,
      otsuTable,
    });
    // 165_000 - 3 × 1610 = 160_170
    expect(result).toBe(160_170);
  });

  it("範囲外 → null", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 500_000, // table に 250000-253000 と 1000000-1005000 のみあるので外れ
      kouOtsu: "kou",
      dependentsCount: 0,
      kouTable,
      otsuTable,
    });
    expect(result).toBeNull();
  });

  it("負数の課税対象 → 0", () => {
    const result = lookupWithholdingTax({
      taxableAmount: -100,
      kouOtsu: "kou",
      dependentsCount: 0,
      kouTable,
      otsuTable,
    });
    expect(result).toBe(0);
  });

  it("扶養 -1 人 → null（不正）", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 251_000,
      kouOtsu: "kou",
      dependentsCount: -1,
      kouTable,
      otsuTable,
    });
    expect(result).toBeNull();
  });
});

describe("lookupWithholdingTax - 乙欄", () => {
  const kouTable = buildKouTable();
  const otsuTable = buildOtsuTable();

  it("課税 251000 → 25000 + (251000-250000) × 0.1063 = 25106", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 251_000,
      kouOtsu: "otsu",
      dependentsCount: 0, // 乙欄は無視
      kouTable,
      otsuTable,
    });
    // 25_000 + 1000 × 0.1063 = 25_106.3 → floor 25_106
    expect(result).toBe(25_106);
  });

  it("乙欄 範囲外 → null", () => {
    const result = lookupWithholdingTax({
      taxableAmount: 500_000,
      kouOtsu: "otsu",
      dependentsCount: 0,
      kouTable,
      otsuTable,
    });
    expect(result).toBeNull();
  });
});

// ============================================================
// 8. calculateTaxableAmount
// ============================================================

describe("calculateTaxableAmount", () => {
  it("通常: gross 350000 - 通勤 30000 - 社保 50000 = 270000", () => {
    expect(
      calculateTaxableAmount({
        grossPay: 350_000,
        nonTaxableCommuteAllowance: 30_000,
        totalSocialInsurance: 50_000,
      }),
    ).toBe(270_000);
  });

  it("マイナス防止: 控除超過 → 0", () => {
    expect(
      calculateTaxableAmount({
        grossPay: 50_000,
        nonTaxableCommuteAllowance: 30_000,
        totalSocialInsurance: 50_000,
      }),
    ).toBe(0);
  });
});

// ============================================================
// 9. decideResidentTax
// ============================================================

describe("decideResidentTax", () => {
  const assignment2026: BudResidentTaxAssignment = {
    id: "rt-2026",
    employeeId: "emp-1",
    fiscalYear: 2026, // 2026/6 - 2027/5
    juneAmount: 12_500,
    monthlyAmount: 12_400,
    sourceMunicipality: "東京都港区",
    notes: null,
  };

  it("2026 年 6 月 → juneAmount", () => {
    expect(decideResidentTax(6, 2026, assignment2026)).toBe(12_500);
  });

  it("2026 年 7 月 → monthlyAmount", () => {
    expect(decideResidentTax(7, 2026, assignment2026)).toBe(12_400);
  });

  it("2027 年 5 月 → monthlyAmount（fiscal_year 2026 のまま）", () => {
    expect(decideResidentTax(5, 2027, assignment2026)).toBe(12_400);
  });

  it("2026 年 5 月 → fiscal_year 不整合（前年度 2025）→ 0", () => {
    expect(decideResidentTax(5, 2026, assignment2026)).toBe(0);
  });
});

// ============================================================
// 10. filterEffectiveAtDate
// ============================================================

describe("filterEffectiveAtDate", () => {
  it("期間内のみフィルタ", () => {
    const records = [
      { effectiveFrom: "2026-04-01", effectiveTo: "2026-06-30" },
      { effectiveFrom: "2026-07-01", effectiveTo: null },
      { effectiveFrom: "2026-01-01", effectiveTo: "2026-03-31" },
    ];
    const result = filterEffectiveAtDate(records, "2026-05-15");
    expect(result.length).toBe(1);
    expect(result[0].effectiveFrom).toBe("2026-04-01");
  });

  it("無期限（effective_to null）も該当", () => {
    const records = [{ effectiveFrom: "2026-04-01", effectiveTo: null }];
    expect(filterEffectiveAtDate(records, "2027-12-31").length).toBe(1);
  });

  it("該当なし", () => {
    const records = [{ effectiveFrom: "2026-04-01", effectiveTo: "2026-06-30" }];
    expect(filterEffectiveAtDate(records, "2027-01-01").length).toBe(0);
  });

  it("境界: effective_from ちょうど", () => {
    const records = [{ effectiveFrom: "2026-04-01", effectiveTo: null }];
    expect(filterEffectiveAtDate(records, "2026-04-01").length).toBe(1);
  });

  it("境界: effective_to ちょうど", () => {
    const records = [{ effectiveFrom: "2026-04-01", effectiveTo: "2026-06-30" }];
    expect(filterEffectiveAtDate(records, "2026-06-30").length).toBe(1);
  });
});

// ============================================================
// 11. calculateNetPay
// ============================================================

describe("calculateNetPay", () => {
  it("総支給 350000 - 社保 50000 - 源泉 7000 - 住民 12000 - その他 1000", () => {
    const r = calculateNetPay({
      grossPay: 350_000,
      totalSocialInsurance: 50_000,
      withholdingTax: 7_000,
      residentTax: 12_000,
      totalOtherDeductions: 1_000,
    });
    expect(r.totalDeductions).toBe(70_000);
    expect(r.netPay).toBe(280_000);
  });

  it("控除 0 → grossPay = netPay", () => {
    const r = calculateNetPay({
      grossPay: 100_000,
      totalSocialInsurance: 0,
      withholdingTax: 0,
      residentTax: 0,
      totalOtherDeductions: 0,
    });
    expect(r.netPay).toBe(100_000);
  });

  it("控除超過 → netPay マイナス（呼び出し側で判定）", () => {
    const r = calculateNetPay({
      grossPay: 50_000,
      totalSocialInsurance: 30_000,
      withholdingTax: 10_000,
      residentTax: 15_000,
      totalOtherDeductions: 0,
    });
    expect(r.totalDeductions).toBe(55_000);
    expect(r.netPay).toBe(-5_000);
  });
});
