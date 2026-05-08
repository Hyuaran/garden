/**
 * D-06 年末調整連携 純関数 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md
 *
 * 網羅項目:
 *   1. calculateAnnualWithheld（11 月までの月次 + 12 月予定 + 賞与の振り分け）
 *   2. classifySettlementType（refund / additional / zero）
 *   3. calculateSettlement（年税額 - 既徴収累計、円単位丸め）
 *   4. applySettlementToSalary（1 月給与精算反映、spec §5.2 数式）
 *   5. validateSettlementWarnings（還付 20%/30% / 追徴 net マイナス / 30% / 分割推奨）
 *   6. planInstallments（最長 12 ヶ月、端数調整、startMonth 跨ぎ）
 *   7. shouldExcludeFromSettlement（当年退職判定、spec §2.1）
 *   8. validateMyNumberFormat（12 桁 + チェックデジット、行政手続番号利用法）
 */

import { describe, it, expect } from "vitest";
import {
  applySettlementToSalary,
  calculateAnnualWithheld,
  calculateSettlement,
  classifySettlementType,
  planInstallments,
  shouldExcludeFromSettlement,
  validateMyNumberFormat,
  validateSettlementWarnings,
} from "../nenmatsu-functions";
import type { MonthlyWithheldRecord } from "../nenmatsu-types";

// ============================================================
// 1. calculateAnnualWithheld
// ============================================================

describe("calculateAnnualWithheld", () => {
  function buildMonthlyRecord(
    month: number,
    withholdingTax: number,
    grossPay = 300000,
  ): MonthlyWithheldRecord {
    return {
      fiscalYear: 2026,
      employeeId: "emp-1",
      periodType: "monthly",
      paymentDate: `2026-${String(month).padStart(2, "0")}-25`,
      grossPay,
      socialInsuranceTotal: 45000,
      withholdingTax,
    };
  }

  function buildBonusRecord(
    paymentDate: string,
    withholdingTax: number,
  ): MonthlyWithheldRecord {
    return {
      fiscalYear: 2026,
      employeeId: "emp-1",
      periodType: "bonus",
      paymentDate,
      grossPay: 500000,
      socialInsuranceTotal: 75000,
      withholdingTax,
    };
  }

  it("11 月までの月次合計が totalWithheldToNovember に集計される", () => {
    const records: MonthlyWithheldRecord[] = [];
    for (let m = 1; m <= 11; m++) {
      records.push(buildMonthlyRecord(m, 5000));
    }

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.totalWithheldToNovember).toBe(55000);
    expect(summary.decemberSalaryWithheld).toBe(0);
    expect(summary.bonusWithheldTotal).toBe(0);
    expect(summary.monthlyRecordCount).toBe(11);
    expect(summary.bonusRecordCount).toBe(0);
  });

  it("12 月給与は decemberSalaryWithheld に分離される", () => {
    const records: MonthlyWithheldRecord[] = [
      ...Array.from({ length: 11 }, (_, i) => buildMonthlyRecord(i + 1, 5000)),
      buildMonthlyRecord(12, 6000),
    ];

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.totalWithheldToNovember).toBe(55000);
    expect(summary.decemberSalaryWithheld).toBe(6000);
    expect(summary.monthlyRecordCount).toBe(12);
  });

  it("賞与は bonusWithheldTotal に集計される（夏冬 2 回）", () => {
    const records = [
      buildBonusRecord("2026-06-15", 80000),
      buildBonusRecord("2026-12-10", 90000),
    ];

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.bonusWithheldTotal).toBe(170000);
    expect(summary.bonusRecordCount).toBe(2);
    expect(summary.monthlyRecordCount).toBe(0);
  });

  it("月次 + 賞与混在で全カテゴリ集計", () => {
    const records: MonthlyWithheldRecord[] = [
      ...Array.from({ length: 11 }, (_, i) => buildMonthlyRecord(i + 1, 5000)),
      buildMonthlyRecord(12, 6000),
      buildBonusRecord("2026-06-15", 80000),
      buildBonusRecord("2026-12-10", 90000),
    ];

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.totalWithheldToNovember).toBe(55000);
    expect(summary.decemberSalaryWithheld).toBe(6000);
    expect(summary.bonusWithheldTotal).toBe(170000);
    expect(summary.totalGrossPay).toBe(11 * 300000 + 300000 + 500000 * 2);
  });

  it("fiscalYear / employeeId フィルタ: 異なる従業員のレコードは除外", () => {
    const records: MonthlyWithheldRecord[] = [
      buildMonthlyRecord(6, 5000),
      {
        ...buildMonthlyRecord(6, 9999),
        employeeId: "emp-other",
      },
    ];

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.totalWithheldToNovember).toBe(5000);
  });

  it("fiscalYear フィルタ: 異なる年度のレコードは除外", () => {
    const records: MonthlyWithheldRecord[] = [
      buildMonthlyRecord(6, 5000),
      {
        ...buildMonthlyRecord(6, 7777),
        fiscalYear: 2025,
      },
    ];

    const summary = calculateAnnualWithheld(records, 2026, "emp-1");

    expect(summary.totalWithheldToNovember).toBe(5000);
  });

  it("空配列 → 全て 0", () => {
    const summary = calculateAnnualWithheld([], 2026, "emp-1");
    expect(summary.totalWithheldToNovember).toBe(0);
    expect(summary.decemberSalaryWithheld).toBe(0);
    expect(summary.bonusWithheldTotal).toBe(0);
    expect(summary.monthlyRecordCount).toBe(0);
  });

  it("不正な ISO 日付で例外", () => {
    const records: MonthlyWithheldRecord[] = [
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        periodType: "monthly",
        paymentDate: "invalid-date",
        grossPay: 300000,
        socialInsuranceTotal: 0,
        withholdingTax: 5000,
      },
    ];
    expect(() => calculateAnnualWithheld(records, 2026, "emp-1")).toThrow();
  });
});

// ============================================================
// 2. classifySettlementType
// ============================================================

describe("classifySettlementType", () => {
  it("正値 → additional", () => {
    expect(classifySettlementType(1)).toBe("additional");
    expect(classifySettlementType(50000)).toBe("additional");
  });

  it("負値 → refund", () => {
    expect(classifySettlementType(-1)).toBe("refund");
    expect(classifySettlementType(-50000)).toBe("refund");
  });

  it("0 → zero", () => {
    expect(classifySettlementType(0)).toBe("zero");
  });
});

// ============================================================
// 3. calculateSettlement
// ============================================================

describe("calculateSettlement", () => {
  it("年税額 < 既徴収 → 還付（refund、負値）", () => {
    const result = calculateSettlement({
      fiscalYear: 2026,
      employeeId: "emp-1",
      annualTaxAmount: 240000,
      totalWithheldToNovember: 220000,
      decemberSalaryWithheld: 20000,
      bonusWithheldTotal: 50000,
    });

    // totalWithheld = 290000, settlement = 240000 - 290000 = -50000
    expect(result.totalWithheld).toBe(290000);
    expect(result.settlementAmount).toBe(-50000);
    expect(result.settlementType).toBe("refund");
  });

  it("年税額 > 既徴収 → 追徴（additional、正値）", () => {
    const result = calculateSettlement({
      fiscalYear: 2026,
      employeeId: "emp-1",
      annualTaxAmount: 350000,
      totalWithheldToNovember: 200000,
      decemberSalaryWithheld: 20000,
      bonusWithheldTotal: 50000,
    });

    // totalWithheld = 270000, settlement = 80000
    expect(result.settlementAmount).toBe(80000);
    expect(result.settlementType).toBe("additional");
  });

  it("年税額 = 既徴収 → zero", () => {
    const result = calculateSettlement({
      fiscalYear: 2026,
      employeeId: "emp-1",
      annualTaxAmount: 240000,
      totalWithheldToNovember: 200000,
      decemberSalaryWithheld: 20000,
      bonusWithheldTotal: 20000,
    });

    expect(result.settlementAmount).toBe(0);
    expect(result.settlementType).toBe("zero");
  });

  it("円未満は 0 方向に丸め（Math.trunc）", () => {
    // 現実的には integer 入力だが、念のため。
    const result = calculateSettlement({
      fiscalYear: 2026,
      employeeId: "emp-1",
      annualTaxAmount: 100000.7,
      totalWithheldToNovember: 100000,
      decemberSalaryWithheld: 0,
      bonusWithheldTotal: 0,
    });
    // raw = 0.7 → trunc → 0
    expect(result.settlementAmount).toBe(0);
  });

  it("負の小数も 0 方向に丸め", () => {
    const result = calculateSettlement({
      fiscalYear: 2026,
      employeeId: "emp-1",
      annualTaxAmount: 99999.3,
      totalWithheldToNovember: 100000,
      decemberSalaryWithheld: 0,
      bonusWithheldTotal: 0,
    });
    // raw = -0.7 → trunc → 0（符号 0 にならず -0 でなく 0）
    expect(result.settlementAmount).toBe(0);
  });
});

// ============================================================
// 4. applySettlementToSalary（spec §5.2 数式検証）
// ============================================================

describe("applySettlementToSalary", () => {
  it("還付（refund、負値）→ 1 月給与プラス、月次源泉は据え置き", () => {
    const result = applySettlementToSalary({
      januaryGrossPay: 300000,
      januaryNormalWithholding: 6000,
      januaryTotalDeductions: 50000, // 6000 含む
      settlementAmount: -50000,
      settlementType: "refund",
    });

    // 月次源泉は据え置き
    expect(result.januaryNormalWithholding).toBe(6000);
    // 精算 = -50000 → finalWithholding = 6000 + (-50000) = -44000
    expect(result.settlementAdjustment).toBe(-50000);
    expect(result.finalWithholding).toBe(-44000);
    // finalTotalDeductions = 50000 - 6000 + (-44000) = 0
    expect(result.finalTotalDeductions).toBe(0);
    // finalNetPay = 300000 - 0 = 300000（手取り 5 万円増）
    expect(result.finalNetPay).toBe(300000);
  });

  it("追徴（additional、正値）→ 1 月給与マイナス分", () => {
    const result = applySettlementToSalary({
      januaryGrossPay: 300000,
      januaryNormalWithholding: 6000,
      januaryTotalDeductions: 50000,
      settlementAmount: 30000,
      settlementType: "additional",
    });

    // finalWithholding = 6000 + 30000 = 36000
    expect(result.finalWithholding).toBe(36000);
    // finalTotalDeductions = 50000 - 6000 + 36000 = 80000
    expect(result.finalTotalDeductions).toBe(80000);
    // finalNetPay = 300000 - 80000 = 220000（手取り 3 万円減）
    expect(result.finalNetPay).toBe(220000);
  });

  it("zero → 1 月給与は変わらず", () => {
    const result = applySettlementToSalary({
      januaryGrossPay: 300000,
      januaryNormalWithholding: 6000,
      januaryTotalDeductions: 50000,
      settlementAmount: 0,
      settlementType: "zero",
    });

    expect(result.finalWithholding).toBe(6000);
    expect(result.finalTotalDeductions).toBe(50000);
    expect(result.finalNetPay).toBe(250000);
  });

  it("追徴過大 → finalNetPay マイナス可能（警告は別関数で）", () => {
    const result = applySettlementToSalary({
      januaryGrossPay: 300000,
      januaryNormalWithholding: 6000,
      januaryTotalDeductions: 50000,
      settlementAmount: 400000, // 異常追徴
      settlementType: "additional",
    });

    // finalWithholding = 406000, finalTotalDeductions = 450000
    expect(result.finalNetPay).toBeLessThan(0);
  });
});

// ============================================================
// 5. validateSettlementWarnings
// ============================================================

describe("validateSettlementWarnings", () => {
  it("通常還付（gross の 10%）→ 警告なし", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 200000,
        totalWithheld: 230000,
        settlementAmount: -30000,
        settlementType: "refund",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: -30000,
        finalWithholding: -24000,
        finalTotalDeductions: 20000,
        finalNetPay: 280000,
      },
      300000,
    );
    expect(warnings).toHaveLength(0);
  });

  it("還付額が gross の 20% 超 → REFUND_EXCESS_GROSS_20PCT", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 200000,
        totalWithheld: 270000,
        settlementAmount: -70000, // 23.3%
        settlementType: "refund",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: -70000,
        finalWithholding: -64000,
        finalTotalDeductions: -14000,
        finalNetPay: 314000,
      },
      300000,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("REFUND_EXCESS_GROSS_20PCT");
    expect(warnings[0].severity).toBe("warning");
  });

  it("還付額が gross の 30% 超 → REFUND_EXCESS_GROSS_30PCT", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 100000,
        totalWithheld: 200000,
        settlementAmount: -100000, // 33.3%
        settlementType: "refund",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: -100000,
        finalWithholding: -94000,
        finalTotalDeductions: -44000,
        finalNetPay: 344000,
      },
      300000,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe("REFUND_EXCESS_GROSS_30PCT");
  });

  it("追徴で finalNetPay マイナス → ADDITIONAL_EXCESS_NET_PAY + INSTALLMENT_RECOMMENDED", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 600000,
        totalWithheld: 200000,
        settlementAmount: 400000,
        settlementType: "additional",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: 400000,
        finalWithholding: 406000,
        finalTotalDeductions: 450000,
        finalNetPay: -150000,
      },
      300000,
    );

    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("ADDITIONAL_EXCESS_NET_PAY");
    expect(codes).toContain("INSTALLMENT_RECOMMENDED");
    const errLevel = warnings.find((w) => w.severity === "error");
    expect(errLevel?.code).toBe("ADDITIONAL_EXCESS_NET_PAY");
  });

  it("追徴額が gross 30% 超 → ADDITIONAL_LARGE_30PCT + INSTALLMENT_RECOMMENDED", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 350000,
        totalWithheld: 250000,
        settlementAmount: 100000, // 33.3%
        settlementType: "additional",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: 100000,
        finalWithholding: 106000,
        finalTotalDeductions: 150000,
        finalNetPay: 150000, // プラス
      },
      300000,
    );

    const codes = warnings.map((w) => w.code);
    expect(codes).toContain("ADDITIONAL_LARGE_30PCT");
    expect(codes).toContain("INSTALLMENT_RECOMMENDED");
    expect(codes).not.toContain("ADDITIONAL_EXCESS_NET_PAY");
  });

  it("zero → 警告なし", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 200000,
        totalWithheld: 200000,
        settlementAmount: 0,
        settlementType: "zero",
      },
      {
        januaryNormalWithholding: 6000,
        settlementAdjustment: 0,
        finalWithholding: 6000,
        finalTotalDeductions: 50000,
        finalNetPay: 250000,
      },
      300000,
    );
    expect(warnings).toHaveLength(0);
  });

  it("gross 0 円（異常）でも 0 除算しない", () => {
    const warnings = validateSettlementWarnings(
      {
        fiscalYear: 2026,
        employeeId: "emp-1",
        annualTaxAmount: 0,
        totalWithheld: 50000,
        settlementAmount: -50000,
        settlementType: "refund",
      },
      {
        januaryNormalWithholding: 0,
        settlementAdjustment: -50000,
        finalWithholding: -50000,
        finalTotalDeductions: -50000,
        finalNetPay: 50000,
      },
      0,
    );
    // ratio = 0 として扱われるため 20%/30% 超えない
    expect(warnings.filter((w) => w.code.startsWith("REFUND"))).toHaveLength(0);
  });
});

// ============================================================
// 6. planInstallments
// ============================================================

describe("planInstallments", () => {
  it("totalAmount=0 → installments 空", () => {
    const plan = planInstallments({
      totalAmount: 0,
      startMonth: 1,
      fiscalYear: 2027,
    });
    expect(plan.installments).toHaveLength(0);
    expect(plan.totalMonths).toBe(0);
  });

  it("monthlyMaxAmount 未指定 → 1 ヶ月で全額", () => {
    const plan = planInstallments({
      totalAmount: 60000,
      startMonth: 1,
      fiscalYear: 2027,
    });
    expect(plan.totalMonths).toBe(1);
    expect(plan.installments).toHaveLength(1);
    expect(plan.installments[0]).toEqual({
      monthNumber: 1,
      fiscalYearOfPayment: 2027,
      amount: 60000,
    });
  });

  it("monthlyMaxAmount 設定 → 必要月数で均等分配 + 端数調整", () => {
    const plan = planInstallments({
      totalAmount: 100000,
      startMonth: 1,
      fiscalYear: 2027,
      monthlyMaxAmount: 30000,
    });
    // ceil(100000/30000) = 4 ヶ月
    expect(plan.totalMonths).toBe(4);
    expect(plan.installments).toHaveLength(4);
    // 最初の 3 ヶ月: floor(100000/4) = 25000
    expect(plan.installments[0].amount).toBe(25000);
    expect(plan.installments[1].amount).toBe(25000);
    expect(plan.installments[2].amount).toBe(25000);
    // 最終月: 残額 = 100000 - 75000 = 25000
    expect(plan.installments[3].amount).toBe(25000);
    // 合計検算
    const sum = plan.installments.reduce((acc, i) => acc + i.amount, 0);
    expect(sum).toBe(100000);
  });

  it("端数調整: totalAmount が均等割でない場合最終月で吸収", () => {
    const plan = planInstallments({
      totalAmount: 100001,
      startMonth: 1,
      fiscalYear: 2027,
      monthlyMaxAmount: 30000,
    });
    // ceil(100001/30000) = 4 ヶ月
    expect(plan.totalMonths).toBe(4);
    // floor(100001/4) = 25000
    expect(plan.installments[0].amount).toBe(25000);
    expect(plan.installments[3].amount).toBe(25001); // 端数
    const sum = plan.installments.reduce((acc, i) => acc + i.amount, 0);
    expect(sum).toBe(100001);
  });

  it("startMonth=10 → 月跨ぎで翌年に進む", () => {
    const plan = planInstallments({
      totalAmount: 60000,
      startMonth: 10,
      fiscalYear: 2027,
      monthlyMaxAmount: 20000,
    });
    expect(plan.totalMonths).toBe(3);
    expect(plan.installments[0]).toEqual({
      monthNumber: 10,
      fiscalYearOfPayment: 2027,
      amount: 20000,
    });
    expect(plan.installments[1]).toEqual({
      monthNumber: 11,
      fiscalYearOfPayment: 2027,
      amount: 20000,
    });
    expect(plan.installments[2]).toEqual({
      monthNumber: 12,
      fiscalYearOfPayment: 2027,
      amount: 20000,
    });
  });

  it("startMonth=11、4 ヶ月分 → 翌年 2 月まで跨ぐ", () => {
    const plan = planInstallments({
      totalAmount: 80000,
      startMonth: 11,
      fiscalYear: 2027,
      monthlyMaxAmount: 20000,
    });
    expect(plan.totalMonths).toBe(4);
    expect(plan.installments[0].monthNumber).toBe(11);
    expect(plan.installments[0].fiscalYearOfPayment).toBe(2027);
    expect(plan.installments[1].monthNumber).toBe(12);
    expect(plan.installments[1].fiscalYearOfPayment).toBe(2027);
    expect(plan.installments[2].monthNumber).toBe(1);
    expect(plan.installments[2].fiscalYearOfPayment).toBe(2028);
    expect(plan.installments[3].monthNumber).toBe(2);
    expect(plan.installments[3].fiscalYearOfPayment).toBe(2028);
  });

  it("12 ヶ月超は exceedsMaxMonths=true で 12 ヶ月に制限", () => {
    const plan = planInstallments({
      totalAmount: 1300000,
      startMonth: 1,
      fiscalYear: 2027,
      monthlyMaxAmount: 100000, // 13 ヶ月必要
    });
    expect(plan.totalMonths).toBe(12); // 上限制限
    expect(plan.exceedsMaxMonths).toBe(true);
    // 最終月で全残額（1300000 - 100000*11 = 200000）
    const sum = plan.installments.reduce((acc, i) => acc + i.amount, 0);
    expect(sum).toBe(1300000);
  });

  it("monthlyMaxAmount=0 で例外", () => {
    expect(() =>
      planInstallments({
        totalAmount: 100000,
        startMonth: 1,
        fiscalYear: 2027,
        monthlyMaxAmount: 0,
      }),
    ).toThrow();
  });
});

// ============================================================
// 7. shouldExcludeFromSettlement
// ============================================================

describe("shouldExcludeFromSettlement", () => {
  it("退職日 NULL → 在籍扱い、対象", () => {
    expect(shouldExcludeFromSettlement(2026, null)).toEqual({
      excluded: false,
      reason: null,
    });
  });

  it("当年内退職 → 除外（retired_in_year）", () => {
    expect(shouldExcludeFromSettlement(2026, "2026-08-31T23:59:59")).toEqual({
      excluded: true,
      reason: "retired_in_year",
    });
  });

  it("12 月末退職も当年内 → 除外（最終給与で即時精算）", () => {
    expect(shouldExcludeFromSettlement(2026, "2026-12-31T15:00:00")).toEqual({
      excluded: true,
      reason: "retired_in_year",
    });
  });

  it("翌年退職 → 在籍扱い", () => {
    expect(shouldExcludeFromSettlement(2026, "2027-01-15T00:00:00")).toEqual({
      excluded: false,
      reason: null,
    });
  });

  it("前年以前退職 → 在籍扱い（既に対象外）", () => {
    expect(shouldExcludeFromSettlement(2026, "2025-06-30T00:00:00")).toEqual({
      excluded: false,
      reason: null,
    });
  });
});

// ============================================================
// 8. validateMyNumberFormat
// ============================================================

describe("validateMyNumberFormat", () => {
  it("12 桁 + 正しいチェックデジット → valid", () => {
    // 上 11 桁 = 12345678901, weights = 6,5,4,3,2,7,6,5,4,3,2
    // sum = 1*6+2*5+3*4+4*3+5*2+6*7+7*6+8*5+9*4+0*3+1*2
    //     = 6+10+12+12+10+42+42+40+36+0+2 = 212
    // 212 % 11 = 3 → 11-3 = 8
    expect(validateMyNumberFormat("123456789018")).toEqual({ valid: true });
  });

  it("12 桁 + 不正なチェックデジット → invalid", () => {
    expect(validateMyNumberFormat("123456789010")).toEqual({
      valid: false,
      error: "チェックデジット不一致",
    });
  });

  it("11 桁 → invalid", () => {
    expect(validateMyNumberFormat("12345678901").valid).toBe(false);
  });

  it("13 桁 → invalid", () => {
    expect(validateMyNumberFormat("1234567890123").valid).toBe(false);
  });

  it("数字以外 → invalid", () => {
    expect(validateMyNumberFormat("12345abc9018").valid).toBe(false);
    expect(validateMyNumberFormat("123-456-789-0").valid).toBe(false);
  });

  it("空文字 → invalid", () => {
    expect(validateMyNumberFormat("").valid).toBe(false);
  });

  it("チェックデジット 0 ケース（remainder<=1）", () => {
    // remainder が 0 or 1 の場合、check digit = 0
    // 全 0 の上 11 桁: sum = 0, remainder = 0, expected = 0
    expect(validateMyNumberFormat("000000000000")).toEqual({ valid: true });
  });
});
