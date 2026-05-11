/**
 * D-11 MFC 互換 CSV 出力 単体テスト
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md
 *
 * 網羅項目:
 *   1. mapToMfcCsvRow（monthly / hourly / daily 形態別）
 *   2. aggregateMfcCsvRows（課税 / 非課税 / 控除合計）
 *   3. MFC_CSV_COLUMN_HEADERS 72 列確認
 *   4. rowToValues（72 値配列）
 *   5. formatCell（数値 / 文字列 / カンマ / 改行 / null）
 *   6. encodeMfcCsv（cp932 エンコード + CRLF + ヘッダ）
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import {
  mapToMfcCsvRow,
  aggregateMfcCsvRows,
} from "../mfc-csv-mapper";
import {
  MFC_CSV_COLUMN_HEADERS,
  rowToValues,
  formatCell,
  rowToCsvLine,
  encodeMfcCsv,
} from "../mfc-csv-encoder";
import {
  MFC_CSV_TOTAL_COLUMNS,
  MFC_CSV_CATEGORY_COL_COUNTS,
  type MfcMapperContext,
  type PaymentType,
} from "../mfc-csv-types";

// ============================================================
// テストフィクスチャ
// ============================================================

function buildContext(paymentType: PaymentType = "monthly"): MfcMapperContext {
  return {
    payrollRecord: {
      employeeId: "emp-1",
      grossPay: 350_000,
      basicPay: 280_000,
      overtimePay: 30_000,
      lateNightPay: 5_000,
      holidayPay: 0,
      legalOvertimePay: 0,
      commuteAllowance: 30_000,
      healthInsurance: 13_944,
      longTermCareInsurance: 0,
      welfarePension: 25_620,
      employmentInsurance: 2_100,
      withholdingTax: 7_000,
      residentTax: 12_400,
      paymentType,
      apIncentive: 0,
      presidentIncentive: 0,
      caseIncentive: 0,
    },
    employee: {
      id: "emp-1",
      employeeNumber: "H001234",
      lastName: "山田",
      firstName: "太郎",
      departmentName: "営業部",
      jobTitle: "主任",
      contractType: "正社員",
      mfcInternalId: "MFC-1234",
    },
    company: {
      id: "comp-1",
      officeName: "ヒュアラン本社",
    },
    salarySystem: {
      paymentType,
      dailyWorkingHours: 8,
      monthlyScheduledMinutes: 10_000,
      monthlyAvgWorkingDays: 20.83,
      weeklyWorkingDays: 5,
      yearlyWorkingDays: 250,
      hourlyRate: paymentType === "hourly" ? 1_500 : null,
      dailyRate: paymentType === "daily" ? 12_000 : null,
    },
    attendance: {
      attendanceDays: 22,
      absentDays: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
      scheduledWorkingMinutes: 10_000,
      overtimeMinutes: 30 * 60,
      lateNightMinutes: 5 * 60,
      paidLeaveDays: 0,
      trainingMinutes: 0,
      officeWorkMinutes: 0,
      actualWorkingMinutes: 10_500,
    },
    commute: {
      taxable: 0,
      nonTaxable: 30_000,
    },
    rakutenAdvancePayment: 0,
    housingRent: 0,
    yearEndAdjustment: 0,
    otherDeductions: [0, 0, 0],
  };
}

// ============================================================
// 1. mapToMfcCsvRow
// ============================================================

describe("mapToMfcCsvRow - monthly（月給制）", () => {
  it("月給制: monthly* フィールドが埋まり、hourly* / daily* は 0", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);

    // 月給フィールド（埋まる）
    expect(row.monthlyBasicPay).toBe(280_000);
    expect(row.monthlyOvertimePay).toBe(30_000);
    expect(row.monthlyLateNightPay).toBe(5_000);
    expect(row.monthlyCommutingNonTaxable).toBe(30_000);

    // 時給フィールド（0）
    expect(row.hourlyBasicPay).toBe(0);
    expect(row.hourlyApIncentive).toBe(0);
    expect(row.hourlyOvertimePay).toBe(0);

    // 日給フィールド（0）
    expect(row.dailyBasicPay).toBe(0);
    expect(row.dailyOvertimePay).toBe(0);
  });

  it("識別 + 所属 + 所定 列が埋まる", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);

    expect(row.version).toBe("1.0");
    expect(row.employeeNumber).toBe("H001234");
    expect(row.lastName).toBe("山田");
    expect(row.firstName).toBe("太郎");
    expect(row.officeName).toBe("ヒュアラン本社");
    expect(row.dailyWorkingHours).toBe(8);
    expect(row.monthlyAvgWorkingDays).toBe(20.83);
  });

  it("勤怠 列（分 → 時間 換算）", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);

    expect(row.attendanceDays).toBe(22);
    expect(row.scheduledWorkingHours).toBe(10_000 / 60); // ≈ 166.67
    expect(row.overtimeHours).toBe(30); // 30h
    expect(row.lateNightHours).toBe(5);
    expect(row.totalWorkingHours).toBe(10_500 / 60); // ≈ 175
  });

  it("控除 列（D-02 + D-05 結果転記）", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);

    expect(row.healthInsurance).toBe(13_944);
    expect(row.welfarePension).toBe(25_620);
    expect(row.employmentInsurance).toBe(2_100);
    expect(row.withholdingTax).toBe(7_000);
    expect(row.residentTax).toBe(12_400);
  });
});

describe("mapToMfcCsvRow - hourly（時給制）", () => {
  it("時給制: インセン 3 種を含む hourly* 列が埋まる、月給/日給は 0", () => {
    const ctx = buildContext("hourly");
    ctx.payrollRecord.apIncentive = 5_000;
    ctx.payrollRecord.presidentIncentive = 50_000;
    ctx.payrollRecord.caseIncentive = 12_000;
    ctx.commute.taxable = 5_000;
    ctx.commute.nonTaxable = 25_000;

    const row = mapToMfcCsvRow(ctx);

    // 時給インセン 3 種
    expect(row.hourlyApIncentive).toBe(5_000);
    expect(row.hourlyPresidentIncentive).toBe(50_000);
    expect(row.hourlyCaseIncentive).toBe(12_000);

    // 通勤手当 課税/非課税分離
    expect(row.hourlyCommutingTaxable).toBe(5_000);
    expect(row.hourlyCommutingNonTaxable).toBe(25_000);

    // 月給/日給は 0
    expect(row.monthlyBasicPay).toBe(0);
    expect(row.dailyBasicPay).toBe(0);
  });
});

describe("mapToMfcCsvRow - daily（日給制）", () => {
  it("日給制: daily* フィールドが埋まる、月給/時給は 0", () => {
    const ctx = buildContext("daily");
    const row = mapToMfcCsvRow(ctx);

    expect(row.dailyBasicPay).toBe(280_000);
    expect(row.dailyOvertimePay).toBe(30_000);
    expect(row.dailyLateNightPay).toBe(5_000);
    expect(row.dailyCommutingNonTaxable).toBe(30_000);

    // 月給/時給は 0
    expect(row.monthlyBasicPay).toBe(0);
    expect(row.hourlyBasicPay).toBe(0);
  });
});

// ============================================================
// 2. aggregateMfcCsvRows
// ============================================================

describe("aggregateMfcCsvRows", () => {
  it("単一行: 月給制 → 課税 + 非課税 + 控除", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const agg = aggregateMfcCsvRows([row]);

    expect(agg.totalEmployees).toBe(1);
    // 月給課税 = basicPay + overtimePay + lateNightPay + commutingTaxable = 280000+30000+5000+0 = 315000
    expect(agg.totalTaxablePayment).toBe(315_000);
    // 非課税通勤 = 30000
    expect(agg.totalNonTaxablePayment).toBe(30_000);
    // 控除 = 13944 + 25620 + 2100 + 7000 + 12400 = 61064
    expect(agg.totalDeduction).toBe(61_064);
  });

  it("複数行（月給 + 時給混在）", () => {
    const ctxMonthly = buildContext("monthly");
    const ctxHourly = buildContext("hourly");
    ctxHourly.payrollRecord.apIncentive = 10_000;

    const rowMonthly = mapToMfcCsvRow(ctxMonthly);
    const rowHourly = mapToMfcCsvRow(ctxHourly);
    const agg = aggregateMfcCsvRows([rowMonthly, rowHourly]);

    expect(agg.totalEmployees).toBe(2);
    expect(agg.totalTaxablePayment).toBeGreaterThan(0);
  });

  it("空配列 → 全部 0", () => {
    const agg = aggregateMfcCsvRows([]);
    expect(agg.totalEmployees).toBe(0);
    expect(agg.totalTaxablePayment).toBe(0);
    expect(agg.totalNonTaxablePayment).toBe(0);
    expect(agg.totalDeduction).toBe(0);
  });
});

// ============================================================
// 3. MFC_CSV_COLUMN_HEADERS 72 列確認
// ============================================================

describe("MFC_CSV_COLUMN_HEADERS", () => {
  it("ヘッダ配列が 72 列ちょうど", () => {
    expect(MFC_CSV_COLUMN_HEADERS.length).toBe(72);
    expect(MFC_CSV_TOTAL_COLUMNS).toBe(72);
  });

  it("9 カテゴリ列数の合計 = 72", () => {
    const sum = Object.values(MFC_CSV_CATEGORY_COL_COUNTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(72);
  });
});

// ============================================================
// 4. rowToValues
// ============================================================

describe("rowToValues", () => {
  it("rowToValues は 72 値の配列を返す（ヘッダ列数と一致）", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const values = rowToValues(row);
    expect(values.length).toBe(72);
    expect(values.length).toBe(MFC_CSV_COLUMN_HEADERS.length);
  });
});

// ============================================================
// 5. formatCell
// ============================================================

describe("formatCell", () => {
  it("数値 → 文字列", () => {
    expect(formatCell(123_456)).toBe("123456");
    expect(formatCell(0)).toBe("0");
    expect(formatCell(-100)).toBe("-100");
  });

  it("通常文字列 → そのまま", () => {
    expect(formatCell("山田")).toBe("山田");
    expect(formatCell("ABC")).toBe("ABC");
  });

  it("null / undefined → 空文字", () => {
    expect(formatCell(null)).toBe("");
    expect(formatCell(undefined)).toBe("");
  });

  it("カンマ含む → ダブルクオート囲い", () => {
    expect(formatCell("a,b")).toBe('"a,b"');
  });

  it("ダブルクオート含む → エスケープ + 囲い", () => {
    expect(formatCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("改行含む → 囲い", () => {
    expect(formatCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

// ============================================================
// 6. rowToCsvLine
// ============================================================

describe("rowToCsvLine", () => {
  it("CSV 1 行（72 値）", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const line = rowToCsvLine(row);
    const cells = line.split(",");
    // ダブルクオート囲い無しの場合 72 セル、囲いあれば split で分割される可能性あり
    expect(cells.length).toBeGreaterThanOrEqual(72);
  });
});

// ============================================================
// 7. encodeMfcCsv
// ============================================================

describe("encodeMfcCsv", () => {
  it("ヘッダ行 + 1 データ行 = 2 行", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const encoded = encodeMfcCsv([row]);

    expect(encoded.totalLines).toBe(2); // ヘッダ + データ 1
    expect(encoded.byteSize).toBeGreaterThan(0);
  });

  it("CRLF 改行が含まれる", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const encoded = encodeMfcCsv([row]);

    expect(encoded.utf8Text).toContain("\r\n");
    expect(encoded.utf8Text.endsWith("\r\n")).toBe(true);
  });

  it("cp932 エンコード後を decode で復元できる", () => {
    const ctx = buildContext("monthly");
    const row = mapToMfcCsvRow(ctx);
    const encoded = encodeMfcCsv([row]);

    const decoded = iconv.decode(encoded.buffer, "cp932");
    expect(decoded).toBe(encoded.utf8Text);
    expect(decoded).toContain("山田"); // 日本語含む
    expect(decoded).toContain("ヒュアラン本社");
  });

  it("空配列 → ヘッダのみ", () => {
    const encoded = encodeMfcCsv([]);
    expect(encoded.totalLines).toBe(1); // ヘッダのみ
    expect(encoded.utf8Text).toContain("従業員番号");
    expect(encoded.utf8Text.endsWith("\r\n")).toBe(true);
  });

  it("複数行（3 件）", () => {
    const rows = [
      mapToMfcCsvRow(buildContext("monthly")),
      mapToMfcCsvRow(buildContext("hourly")),
      mapToMfcCsvRow(buildContext("daily")),
    ];
    const encoded = encodeMfcCsv(rows);
    expect(encoded.totalLines).toBe(4); // ヘッダ + 3 データ
  });
});
