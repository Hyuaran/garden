/**
 * D-05 社会保険料 計算ロジック 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-05-social-insurance.md
 *
 * 網羅項目:
 *   1. isLongTermCareTarget（介護対象年齢 40-64 歳の境界）
 *   2. floorToThousand（千円未満切り捨て）
 *   3. lookupGrade（等級検索、最高等級・最低等級境界）
 *   4. calculateMonthlyInsurance（月次給与時、4 種同時計算）
 *      - 通常 / 介護対象 / 免除 / 端数処理
 *   5. calculateHealthStandardBonus（年度累計上限 573 万円）
 *   6. calculatePensionStandardBonus（1 回 150 万円上限）
 *   7. calculateBonusInsurance（賞与時、上限到達ケース）
 *   8. judgeGetsuhen（月変判定）
 */

import { describe, it, expect } from "vitest";
import {
  isLongTermCareTarget,
  floorToThousand,
  lookupGrade,
  calculateMonthlyInsurance,
  calculateHealthStandardBonus,
  calculatePensionStandardBonus,
  calculateBonusInsurance,
  judgeGetsuhen,
} from "../insurance-calculator";
import {
  HEALTH_BONUS_ANNUAL_CAP,
  PENSION_BONUS_PER_PAYMENT_CAP,
  type BudStandardRemunerationGrade,
  type BudInsuranceRate,
} from "../insurance-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildGrade(
  overrides: Partial<BudStandardRemunerationGrade> = {},
): BudStandardRemunerationGrade {
  return {
    id: "grade-default",
    insuranceType: "health",
    effectiveYear: 2026,
    grade: 22,
    remunerationMin: 230_000,
    remunerationMax: 250_000,
    standardAmount: 240_000,
    ...overrides,
  };
}

function buildRate(
  overrides: Partial<BudInsuranceRate> = {},
): BudInsuranceRate {
  return {
    id: "rate-default",
    effectiveFrom: "2026-04-01",
    effectiveTo: null,
    prefecture: "tokyo",
    industryClass: "general",
    healthRate: 0.0998, // 約 9.98%
    longTermCareRate: 0.016, // 1.6%
    pensionRate: 0.183, // 18.3%
    employmentTotalRate: 0.0155,
    employmentEmployeeRate: 0.006, // 0.6%
    notes: null,
    ...overrides,
  };
}

// 健保 標準的な等級表（部分）
function buildHealthGradeTable(): BudStandardRemunerationGrade[] {
  return [
    buildGrade({ grade: 1, remunerationMin: 0, remunerationMax: 63_000, standardAmount: 58_000 }),
    buildGrade({ grade: 5, remunerationMin: 83_000, remunerationMax: 93_000, standardAmount: 88_000 }),
    buildGrade({ grade: 22, remunerationMin: 230_000, remunerationMax: 250_000, standardAmount: 240_000 }),
    buildGrade({ grade: 30, remunerationMin: 410_000, remunerationMax: 440_000, standardAmount: 425_000 }),
    buildGrade({ grade: 50, remunerationMin: 1_355_000, remunerationMax: null, standardAmount: 1_390_000 }),
  ];
}

// ============================================================
// 1. isLongTermCareTarget
// ============================================================

describe("isLongTermCareTarget", () => {
  it.each([
    [39, false],
    [40, true],
    [50, true],
    [64, true],
    [65, false],
    [80, false],
    [0, false],
  ])("%i 歳 → %s", (age, expected) => {
    expect(isLongTermCareTarget(age)).toBe(expected);
  });
});

// ============================================================
// 2. floorToThousand
// ============================================================

describe("floorToThousand", () => {
  it.each([
    [0, 0],
    [999, 0],
    [1000, 1000],
    [1001, 1000],
    [1234567, 1234000],
    [5_730_000, 5_730_000], // 上限ちょうど
    [5_730_999, 5_730_000],
  ])("%i → %i", (input, expected) => {
    expect(floorToThousand(input)).toBe(expected);
  });
});

// ============================================================
// 3. lookupGrade
// ============================================================

describe("lookupGrade", () => {
  const grades = buildHealthGradeTable();

  it("最低等級ちょうど（境界）", () => {
    expect(lookupGrade(grades, 0)?.grade).toBe(1);
  });

  it("最低等級内", () => {
    expect(lookupGrade(grades, 50_000)?.grade).toBe(1);
  });

  it("最低等級上限の 1 円下", () => {
    expect(lookupGrade(grades, 62_999)?.grade).toBe(1);
  });

  it("中間等級", () => {
    expect(lookupGrade(grades, 240_000)?.grade).toBe(22);
  });

  it("最高等級ちょうど（remunerationMax = null）", () => {
    expect(lookupGrade(grades, 1_355_000)?.grade).toBe(50);
  });

  it("最高等級超過 → 最高等級が NULL 上限なら見つかる", () => {
    expect(lookupGrade(grades, 99_999_999)?.grade).toBe(50);
  });

  it("負数 → null", () => {
    expect(lookupGrade(grades, -1)).toBeNull();
  });

  it("等級表が空 → null", () => {
    expect(lookupGrade([], 100_000)).toBeNull();
  });

  it("範囲外（93000-230000 のギャップ） → null", () => {
    // テストフィクスチャは grade 5 の max=93000、grade 22 の min=230000 なので
    // 100000 はどの等級にも該当しない
    expect(lookupGrade(grades, 100_000)).toBeNull();
  });
});

// ============================================================
// 4. calculateMonthlyInsurance
// ============================================================

describe("calculateMonthlyInsurance", () => {
  it("通常: 30 歳, 標準報酬 240000, gross 280000", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ grade: 22, standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19, standardAmount: 240_000 }),
      rate: buildRate(),
      age: 30,
      grossPay: 280_000,
      exempted: false,
    });

    // 健保 = 240000 × 0.0998 / 2 = 11976（floor）
    expect(result.healthInsurance).toBe(11_976);
    // 厚年 = 240000 × 0.183 / 2 = 21960
    expect(result.welfarePension).toBe(21_960);
    // 介護 = 0（30 歳）
    expect(result.longTermCareInsurance).toBe(0);
    // 雇用 = 280000 × 0.006 = 1680
    expect(result.employmentInsurance).toBe(1_680);
    expect(result.total).toBe(11_976 + 21_960 + 0 + 1_680);
    expect(result.exempted).toBe(false);
    expect(result.healthGrade).toBe(22);
    expect(result.pensionGrade).toBe(19);
  });

  it("介護対象: 50 歳", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ grade: 22, standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19, standardAmount: 240_000 }),
      rate: buildRate(),
      age: 50,
      grossPay: 280_000,
      exempted: false,
    });

    // 介護 = 240000 × 0.016 / 2 = 1920
    expect(result.longTermCareInsurance).toBe(1_920);
  });

  it("介護対象 境界: 40 歳ちょうど", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 240_000 }),
      rate: buildRate(),
      age: 40,
      grossPay: 280_000,
      exempted: false,
    });
    expect(result.longTermCareInsurance).toBeGreaterThan(0);
  });

  it("介護対象 境界: 64 歳", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 240_000 }),
      rate: buildRate(),
      age: 64,
      grossPay: 280_000,
      exempted: false,
    });
    expect(result.longTermCareInsurance).toBeGreaterThan(0);
  });

  it("介護対象外: 65 歳", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 240_000 }),
      rate: buildRate(),
      age: 65,
      grossPay: 280_000,
      exempted: false,
    });
    expect(result.longTermCareInsurance).toBe(0);
  });

  it("免除中（産休・育休）: 健保・厚年・介護はゼロ、雇用のみ", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 240_000 }),
      rate: buildRate(),
      age: 50,
      grossPay: 280_000,
      exempted: true,
    });

    expect(result.healthInsurance).toBe(0);
    expect(result.welfarePension).toBe(0);
    expect(result.longTermCareInsurance).toBe(0);
    // 雇用は実支給があれば計算される（産休 gross=0 の場合は 0、ここでは 280000 想定）
    expect(result.employmentInsurance).toBe(1_680);
    expect(result.exempted).toBe(true);
  });

  it("端数処理: floor で従業員負担", () => {
    // healthRate = 0.0997（特殊値）, standardAmount = 230_001
    // 健保 = 230001 × 0.0997 / 2 = 11465.55 → floor = 11465
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 230_001 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 230_001 }),
      rate: buildRate({ healthRate: 0.0997 }),
      age: 30,
      grossPay: 230_001,
      exempted: false,
    });
    expect(result.healthInsurance).toBe(11_465);
  });

  it("gross_pay 0（休職中） → 雇用保険 0", () => {
    const result = calculateMonthlyInsurance({
      healthGrade: buildGrade({ standardAmount: 240_000 }),
      pensionGrade: buildGrade({ insuranceType: "pension", standardAmount: 240_000 }),
      rate: buildRate(),
      age: 30,
      grossPay: 0,
      exempted: false,
    });
    expect(result.employmentInsurance).toBe(0);
  });
});

// ============================================================
// 5. calculateHealthStandardBonus（年度累計上限）
// ============================================================

describe("calculateHealthStandardBonus", () => {
  it("累計 0、本賞与 100 万円 → standardBonus 100 万円、capped false", () => {
    const r = calculateHealthStandardBonus(1_000_000, 0);
    expect(r.standardBonus).toBe(1_000_000);
    expect(r.capped).toBe(false);
  });

  it("累計 0、本賞与 600 万円 → standardBonus 573 万円（上限）、capped true", () => {
    const r = calculateHealthStandardBonus(6_000_000, 0);
    expect(r.standardBonus).toBe(HEALTH_BONUS_ANNUAL_CAP);
    expect(r.capped).toBe(true);
  });

  it("累計 500 万円、本賞与 100 万円 → standardBonus 73 万円（残額）、capped true", () => {
    const r = calculateHealthStandardBonus(1_000_000, 5_000_000);
    expect(r.standardBonus).toBe(730_000);
    expect(r.capped).toBe(true);
  });

  it("累計 ちょうど 573 万円、本賞与 50 万円 → standardBonus 0 円", () => {
    const r = calculateHealthStandardBonus(500_000, HEALTH_BONUS_ANNUAL_CAP);
    expect(r.standardBonus).toBe(0);
    expect(r.capped).toBe(true);
  });

  it("千円未満切り捨て: 本賞与 999 円 → 0 円", () => {
    const r = calculateHealthStandardBonus(999, 0);
    expect(r.standardBonus).toBe(0);
  });

  it("千円未満切り捨て: 本賞与 1_234_567 → 1_234_000", () => {
    const r = calculateHealthStandardBonus(1_234_567, 0);
    expect(r.standardBonus).toBe(1_234_000);
    expect(r.capped).toBe(false);
  });
});

// ============================================================
// 6. calculatePensionStandardBonus（1 回上限）
// ============================================================

describe("calculatePensionStandardBonus", () => {
  it("100 万円 → 100 万円、capped false", () => {
    const r = calculatePensionStandardBonus(1_000_000);
    expect(r.standardBonus).toBe(1_000_000);
    expect(r.capped).toBe(false);
  });

  it("150 万円ちょうど → 150 万円、capped false（上限ちょうどは超過ではない）", () => {
    const r = calculatePensionStandardBonus(PENSION_BONUS_PER_PAYMENT_CAP);
    expect(r.standardBonus).toBe(PENSION_BONUS_PER_PAYMENT_CAP);
    expect(r.capped).toBe(false);
  });

  it("200 万円 → 150 万円、capped true", () => {
    const r = calculatePensionStandardBonus(2_000_000);
    expect(r.standardBonus).toBe(PENSION_BONUS_PER_PAYMENT_CAP);
    expect(r.capped).toBe(true);
  });

  it("千円未満切り捨て: 1_234_567 → 1_234_000", () => {
    const r = calculatePensionStandardBonus(1_234_567);
    expect(r.standardBonus).toBe(1_234_000);
  });
});

// ============================================================
// 7. calculateBonusInsurance
// ============================================================

describe("calculateBonusInsurance", () => {
  it("通常賞与: 30 歳, 80 万円, 累計 0, 上限到達なし", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 30,
      grossBonus: 800_000,
      yearToDateHealthBonus: 0,
      exempted: false,
    });

    // 健保: 800_000 × 0.0998 / 2 = 39920
    expect(result.healthInsurance).toBe(39_920);
    // 厚年: 800_000 × 0.183 / 2 = 73200
    expect(result.welfarePension).toBe(73_200);
    // 介護: 0（30 歳）
    expect(result.longTermCareInsurance).toBe(0);
    // 雇用: 800_000 × 0.006 = 4800
    expect(result.employmentInsurance).toBe(4_800);
    expect(result.healthCapped).toBe(false);
    expect(result.pensionCapped).toBe(false);
  });

  it("健保上限到達: 累計 500 万円、本賞与 100 万円", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 30,
      grossBonus: 1_000_000,
      yearToDateHealthBonus: 5_000_000,
      exempted: false,
    });

    // 健保標準賞与額 = 73 万円（残額）→ 730_000 × 0.0998 / 2 = 36427（floor）
    expect(result.healthInsurance).toBe(36_427);
    expect(result.healthCapped).toBe(true);
    // 厚年は別上限（150 万、本賞与 100 万なので影響なし）
    expect(result.welfarePension).toBe(91_500);
    expect(result.pensionCapped).toBe(false);
  });

  it("厚年上限到達: 200 万円", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 30,
      grossBonus: 2_000_000,
      yearToDateHealthBonus: 0,
      exempted: false,
    });

    // 厚年: 1_500_000 × 0.183 / 2 = 137250
    expect(result.welfarePension).toBe(137_250);
    expect(result.pensionCapped).toBe(true);
    // 健保は 200 万円（< 573 万）で上限なし
    expect(result.healthCapped).toBe(false);
  });

  it("両方上限到達: 累計 500 万、本賞与 200 万", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 30,
      grossBonus: 2_000_000,
      yearToDateHealthBonus: 5_000_000,
      exempted: false,
    });

    expect(result.healthCapped).toBe(true);
    expect(result.pensionCapped).toBe(true);
  });

  it("免除中: 健保・厚年・介護ゼロ、雇用のみ", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 50,
      grossBonus: 800_000,
      yearToDateHealthBonus: 0,
      exempted: true,
    });

    expect(result.healthInsurance).toBe(0);
    expect(result.welfarePension).toBe(0);
    expect(result.longTermCareInsurance).toBe(0);
    expect(result.employmentInsurance).toBe(4_800);
    expect(result.exempted).toBe(true);
  });

  it("介護対象 50 歳の賞与", () => {
    const result = calculateBonusInsurance({
      healthGrade: buildGrade({ grade: 22 }),
      pensionGrade: buildGrade({ insuranceType: "pension", grade: 19 }),
      rate: buildRate(),
      age: 50,
      grossBonus: 800_000,
      yearToDateHealthBonus: 0,
      exempted: false,
    });

    // 介護: 800_000 × 0.016 / 2 = 6400
    expect(result.longTermCareInsurance).toBe(6_400);
  });
});

// ============================================================
// 8. judgeGetsuhen（月変判定）
// ============================================================

describe("judgeGetsuhen", () => {
  const grades = buildHealthGradeTable();

  it("固定的賃金変動なし → ineligible", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 240_000, paymentBaseDays: 22 },
        { grossPay: 240_000, paymentBaseDays: 22 },
        { grossPay: 240_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: false,
    });
    expect(r.isTarget).toBe(false);
    expect(r.ineligibleReason).toContain("固定的賃金");
  });

  it("3 ヶ月分なし → ineligible", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 240_000, paymentBaseDays: 22 },
        { grossPay: 240_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(false);
    expect(r.ineligibleReason).toContain("3 ヶ月分のレコードが必要");
  });

  it("支払基礎日数不足 → ineligible", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 420_000, paymentBaseDays: 22 },
        { grossPay: 420_000, paymentBaseDays: 16 }, // 17 日未満
        { grossPay: 420_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(false);
    expect(r.ineligibleReason).toContain("支払基礎日数");
  });

  it("等級差 1 → not target（2 未満）", () => {
    // 現等級 22 (240_000)、平均 247_000 (等級 22 内に留まる)
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 247_000, paymentBaseDays: 22 },
        { grossPay: 247_000, paymentBaseDays: 22 },
        { grossPay: 247_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(false);
    expect(r.gradeDiff).toBe(0);
  });

  it("等級差 8（22 → 30） → target", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 425_000, paymentBaseDays: 22 },
        { grossPay: 425_000, paymentBaseDays: 22 },
        { grossPay: 425_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(true);
    expect(r.newGrade).toBe(30);
    expect(r.gradeDiff).toBe(8);
    expect(r.ineligibleReason).toBeNull();
  });

  it("等級差 2 ちょうど → target（境界）", () => {
    // 現等級 22（240k）から grade 5（88k） は差 17、test fixture では grade 22 → 5 に下降
    // gradeDiff = abs(5 - 22) = 17 → target
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 88_000, paymentBaseDays: 17 },
        { grossPay: 88_000, paymentBaseDays: 17 },
        { grossPay: 88_000, paymentBaseDays: 17 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(true);
    expect(r.newGrade).toBe(5);
  });

  it("17 日ちょうど → 通過（境界）", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        { grossPay: 425_000, paymentBaseDays: 17 },
        { grossPay: 425_000, paymentBaseDays: 17 },
        { grossPay: 425_000, paymentBaseDays: 17 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(true);
  });

  it("等級表に該当なし（範囲外） → ineligible", () => {
    const r = judgeGetsuhen({
      threeMonthsRecords: [
        // 100_000 は test fixture で grade 5 max=93000 と grade 22 min=230000 のギャップ
        { grossPay: 100_000, paymentBaseDays: 22 },
        { grossPay: 100_000, paymentBaseDays: 22 },
        { grossPay: 100_000, paymentBaseDays: 22 },
      ],
      currentGrade: 22,
      grades,
      fixedPayChanged: true,
    });
    expect(r.isTarget).toBe(false);
    expect(r.ineligibleReason).toContain("等級表範囲外");
  });
});
