/**
 * D-03 賞与計算 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-03-bonus-calculation.md
 *
 * 網羅項目:
 *   1. calculateBonusGross（base + performance + additions）
 *   2. lookupBonusWithholdingRate（甲: 0-7 人 / 7 人超 dependents_7 流用、乙: 同様、範囲外）
 *   3. calculateBonusWithholdingTax（課税対象額 × 算出率、floor）
 *   4. calculateBonusNet（gross - 社保 - 源泉）
 *   5. calculateBonusFull（統合: gross + 社保 + 源泉 + ネット）
 */

import { describe, it, expect } from "vitest";
import {
  calculateBonusGross,
  lookupBonusWithholdingRate,
  calculateBonusWithholdingTax,
  calculateBonusNet,
  calculateBonusFull,
} from "../bonus-calculator";
import type { BonusWithholdingRateRow } from "../bonus-types";
import type {
  BudStandardRemunerationGrade,
  BudInsuranceRate,
} from "../insurance-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildBonusRateTable(): BonusWithholdingRateRow[] {
  // 賞与算出率表 サンプル（実際は数十行、単体テスト用最小限）
  return [
    // 甲欄
    {
      id: "kou-1",
      effectiveYear: 2026,
      kouOtsu: "kou",
      previousMonthMin: 0,
      previousMonthMax: 68_000,
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
      kouOtsu: "kou",
      previousMonthMin: 220_000,
      previousMonthMax: 250_000,
      dependents0: 0.04084,
      dependents1: 0.02042,
      dependents2: 0,
      dependents3: 0,
      dependents4: 0,
      dependents5: 0,
      dependents6: 0,
      dependents7: 0,
    },
    {
      id: "kou-3",
      effectiveYear: 2026,
      kouOtsu: "kou",
      previousMonthMin: 1_000_000,
      previousMonthMax: null, // 上限なし
      dependents0: 0.45945,
      dependents1: 0.45945,
      dependents2: 0.45945,
      dependents3: 0.45945,
      dependents4: 0.45945,
      dependents5: 0.45945,
      dependents6: 0.45945,
      dependents7: 0.45945,
    },
    // 乙欄
    {
      id: "otsu-1",
      effectiveYear: 2026,
      kouOtsu: "otsu",
      previousMonthMin: 0,
      previousMonthMax: 222_000,
      dependents0: 0.10211,
      dependents1: 0.10211,
      dependents2: 0.10211,
      dependents3: 0.10211,
      dependents4: 0.10211,
      dependents5: 0.10211,
      dependents6: 0.10211,
      dependents7: 0.10211,
    },
  ];
}

function buildHealthGrade(amount = 240_000): BudStandardRemunerationGrade {
  return {
    id: "h",
    insuranceType: "health",
    effectiveYear: 2026,
    grade: 22,
    remunerationMin: amount - 10_000,
    remunerationMax: amount + 10_000,
    standardAmount: amount,
  };
}

function buildPensionGrade(amount = 240_000): BudStandardRemunerationGrade {
  return {
    id: "p",
    insuranceType: "pension",
    effectiveYear: 2026,
    grade: 19,
    remunerationMin: amount - 10_000,
    remunerationMax: amount + 10_000,
    standardAmount: amount,
  };
}

function buildRate(): BudInsuranceRate {
  return {
    id: "r",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    prefecture: "tokyo",
    industryClass: "general",
    healthRate: 0.0998,
    longTermCareRate: 0.016,
    pensionRate: 0.183,
    employmentTotalRate: 0.0155,
    employmentEmployeeRate: 0.006,
    notes: null,
  };
}

// ============================================================
// 1. calculateBonusGross
// ============================================================

describe("calculateBonusGross", () => {
  it("基本のみ", () => {
    const r = calculateBonusGross({
      baseBonus: 500_000,
      performanceAddition: 0,
      otherAdditions: {},
    });
    expect(r.grossBonus).toBe(500_000);
    expect(r.otherAdditionsTotal).toBe(0);
  });

  it("基本 + 業績 + 加算 2 種", () => {
    const r = calculateBonusGross({
      baseBonus: 500_000,
      performanceAddition: 50_000,
      otherAdditions: { 役職加算: 30_000, 営業加算: 20_000 },
    });
    expect(r.otherAdditionsTotal).toBe(50_000);
    expect(r.grossBonus).toBe(600_000);
  });

  it("基本 0 + 加算のみ（決算賞与全額加算扱い）", () => {
    const r = calculateBonusGross({
      baseBonus: 0,
      performanceAddition: 0,
      otherAdditions: { 決算賞与: 1_000_000 },
    });
    expect(r.grossBonus).toBe(1_000_000);
  });
});

// ============================================================
// 2. lookupBonusWithholdingRate
// ============================================================

describe("lookupBonusWithholdingRate - 甲欄", () => {
  const rateTable = buildBonusRateTable();

  it("前月給与 240k 扶養 0 人 → 0.04084", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 240_000,
      kouOtsu: "kou",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBe(0.04084);
  });

  it("前月給与 240k 扶養 1 人 → 0.02042", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 240_000,
      kouOtsu: "kou",
      dependentsCount: 1,
      rateTable,
    });
    expect(r).toBe(0.02042);
  });

  it("前月給与 240k 扶養 5 人 → 0（試料 dependents_5 = 0）", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 240_000,
      kouOtsu: "kou",
      dependentsCount: 5,
      rateTable,
    });
    expect(r).toBe(0);
  });

  it("扶養 8 人 → dependents_7 流用（spec §6.1 注釈通り）", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 240_000,
      kouOtsu: "kou",
      dependentsCount: 8,
      rateTable,
    });
    // dependents_7 = 0 のテーブル → 0
    expect(r).toBe(0);
  });

  it("扶養 10 人 高所得 (上限なし行) → dependents_7 流用 0.45945", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 1_500_000,
      kouOtsu: "kou",
      dependentsCount: 10,
      rateTable,
    });
    expect(r).toBe(0.45945);
  });

  it("最高範囲 ちょうど（上限なし行 min）", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 1_000_000,
      kouOtsu: "kou",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBe(0.45945);
  });

  it("範囲外（68001 - 219999、テーブルにギャップ） → null", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 100_000,
      kouOtsu: "kou",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBeNull();
  });

  it("負数前月給与 → null", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: -1,
      kouOtsu: "kou",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBeNull();
  });

  it("負数扶養 → null", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 240_000,
      kouOtsu: "kou",
      dependentsCount: -1,
      rateTable,
    });
    expect(r).toBeNull();
  });
});

describe("lookupBonusWithholdingRate - 乙欄", () => {
  const rateTable = buildBonusRateTable();

  it("乙欄 100_000 → 0.10211（扶養関係なし）", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 100_000,
      kouOtsu: "otsu",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBe(0.10211);
  });

  it("乙欄 範囲外 → null", () => {
    const r = lookupBonusWithholdingRate({
      previousMonthTaxableAmount: 500_000,
      kouOtsu: "otsu",
      dependentsCount: 0,
      rateTable,
    });
    expect(r).toBeNull();
  });
});

// ============================================================
// 3. calculateBonusWithholdingTax
// ============================================================

describe("calculateBonusWithholdingTax", () => {
  it("通常: 課税 50 万円 × 0.04084 = 20420（floor）", () => {
    const r = calculateBonusWithholdingTax({
      taxableBonusAmount: 500_000,
      withholdingRate: 0.04084,
    });
    expect(r).toBe(20_420);
  });

  it("端数: 51 万 × 0.04084 = 20828.4 → floor 20828", () => {
    const r = calculateBonusWithholdingTax({
      taxableBonusAmount: 510_000,
      withholdingRate: 0.04084,
    });
    expect(r).toBe(20_828);
  });

  it("課税 0 → 0", () => {
    expect(
      calculateBonusWithholdingTax({ taxableBonusAmount: 0, withholdingRate: 0.04084 }),
    ).toBe(0);
  });

  it("課税負数 → 0（防止）", () => {
    expect(
      calculateBonusWithholdingTax({ taxableBonusAmount: -1000, withholdingRate: 0.04084 }),
    ).toBe(0);
  });

  it("算出率 0 → 0（範囲外時の出力）", () => {
    expect(
      calculateBonusWithholdingTax({ taxableBonusAmount: 500_000, withholdingRate: 0 }),
    ).toBe(0);
  });
});

// ============================================================
// 4. calculateBonusNet
// ============================================================

describe("calculateBonusNet", () => {
  it("gross 50 万 - 社保 8 万 - 源泉 2 万 = ネット 40 万", () => {
    const r = calculateBonusNet({
      grossBonus: 500_000,
      totalSocialInsurance: 80_000,
      withholdingTax: 20_000,
    });
    expect(r.totalDeductions).toBe(100_000);
    expect(r.netBonus).toBe(400_000);
  });

  it("控除 0 → ネット = gross", () => {
    const r = calculateBonusNet({
      grossBonus: 100_000,
      totalSocialInsurance: 0,
      withholdingTax: 0,
    });
    expect(r.netBonus).toBe(100_000);
  });
});

// ============================================================
// 5. calculateBonusFull（統合）
// ============================================================

describe("calculateBonusFull - 統合計算", () => {
  const rateTable = buildBonusRateTable();

  it("通常賞与: 30 歳、80 万円、累計 0、前月給与 240k 扶養 0", () => {
    const r = calculateBonusFull({
      gross: {
        baseBonus: 800_000,
        performanceAddition: 0,
        otherAdditions: {},
      },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 0,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 240_000,
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.gross.grossBonus).toBe(800_000);
    expect(r.healthCapped).toBe(false);
    expect(r.pensionCapped).toBe(false);
    expect(r.withholdingRate).toBe(0.04084);
    // 健保: 800_000 × 0.0998 / 2 = 39920
    expect(r.socialInsurance.healthInsurance).toBe(39_920);
    // 厚年: 800_000 × 0.183 / 2 = 73200
    expect(r.socialInsurance.welfarePension).toBe(73_200);
    // 雇用: 800_000 × 0.006 = 4800
    expect(r.socialInsurance.employmentInsurance).toBe(4_800);
    // 介護: 0（30 歳）
    expect(r.socialInsurance.longTermCareInsurance).toBe(0);
    // 課税対象 = 800000 - (39920 + 73200 + 4800) = 682080
    // 源泉 = 682080 × 0.04084 = 27856.14 → floor 27856
    expect(r.withholdingTax).toBe(27_856);
    // ネット = 800000 - (39920+73200+4800) - 27856 = 654224
    expect(r.net.netBonus).toBe(654_224);
  });

  it("免除中（産休）: 健保・厚年・介護 0、雇用と源泉のみ", () => {
    const r = calculateBonusFull({
      gross: { baseBonus: 800_000, performanceAddition: 0, otherAdditions: {} },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 0,
        exempted: true,
      },
      rateLookup: {
        previousMonthTaxableAmount: 240_000,
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.socialInsurance.healthInsurance).toBe(0);
    expect(r.socialInsurance.welfarePension).toBe(0);
    expect(r.socialInsurance.employmentInsurance).toBe(4_800);
    expect(r.socialInsurance.exempted).toBe(true);
  });

  it("健保上限到達: 累計 500 万 + 本賞与 100 万", () => {
    const r = calculateBonusFull({
      gross: { baseBonus: 1_000_000, performanceAddition: 0, otherAdditions: {} },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 5_000_000,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 240_000,
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.healthCapped).toBe(true);
    // 健保: 残額 73 万 × 0.0998 / 2 = 36427
    expect(r.socialInsurance.healthInsurance).toBe(36_427);
  });

  it("算出率 範囲外 → withholdingRate=0 / withholdingTax=0", () => {
    const r = calculateBonusFull({
      gross: { baseBonus: 800_000, performanceAddition: 0, otherAdditions: {} },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 0,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 100_000, // ギャップ範囲外
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.withholdingRate).toBe(0);
    expect(r.withholdingTax).toBe(0);
    // ネット = gross - 社保（源泉なし）
    expect(r.net.netBonus).toBe(800_000 - r.socialInsurance.total);
  });

  it("乙欄: 高税率", () => {
    const r = calculateBonusFull({
      gross: { baseBonus: 500_000, performanceAddition: 0, otherAdditions: {} },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 0,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 100_000,
        kouOtsu: "otsu",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.withholdingRate).toBe(0.10211);
    // 課税 = 500_000 - 社保合計
    // 源泉 = 課税 × 0.10211（floor）
    expect(r.withholdingTax).toBeGreaterThan(0);
  });

  it("加算合算: base + performance + 2 加算", () => {
    const r = calculateBonusFull({
      gross: {
        baseBonus: 500_000,
        performanceAddition: 50_000,
        otherAdditions: { 役職加算: 30_000, 営業加算: 20_000 },
      },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 30,
        yearToDateHealthBonus: 0,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 240_000,
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });

    expect(r.gross.grossBonus).toBe(600_000);
  });

  it("介護対象 50 歳", () => {
    const r = calculateBonusFull({
      gross: { baseBonus: 800_000, performanceAddition: 0, otherAdditions: {} },
      insurance: {
        healthGrade: buildHealthGrade(),
        pensionGrade: buildPensionGrade(),
        rate: buildRate(),
        age: 50,
        yearToDateHealthBonus: 0,
        exempted: false,
      },
      rateLookup: {
        previousMonthTaxableAmount: 240_000,
        kouOtsu: "kou",
        dependentsCount: 0,
        rateTable,
      },
    });
    // 介護: 800_000 × 0.016 / 2 = 6400
    expect(r.socialInsurance.longTermCareInsurance).toBe(6_400);
  });
});
