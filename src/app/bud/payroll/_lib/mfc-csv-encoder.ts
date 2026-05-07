/**
 * Garden-Bud / Phase D #11 MFC CSV cp932 エンコーダー（純関数 + iconv-lite）
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md §4.3
 *
 * 出力仕様:
 *   - エンコーディング: cp932（Shift_JIS 系、Windows 標準、MFC 受入形式）
 *   - 改行: CRLF
 *   - 列区切り: カンマ
 *   - エスケープ: ダブルクオート囲い + ダブルクオート二重化
 *
 * 依存: iconv-lite（Phase 1a 既存）
 */

import iconv from "iconv-lite";
import type { MfcCsvRow } from "./mfc-csv-types";

// ============================================================
// 72 列カラム名（CSV ヘッダ行）
// ============================================================
// 注: 実際の MFC サンプル CSV のヘッダ文字列と memory project_mfc_payroll_csv_format.md
// を 1:1 対応で確定する。本実装は MfcCsvRow の key 順を踏襲した代表名。
// 実装フェーズで MFC サンプル CSV と byte 一致確認を実施（spec §10 受入基準）。

export const MFC_CSV_COLUMN_HEADERS: readonly string[] = [
  // 識別（5 列）
  "バージョン",
  "従業員識別子",
  "従業員番号",
  "姓",
  "名",
  // 所属（4 列）
  "事業所名",
  "部門名",
  "職種名",
  "契約種別",
  // 所定（5 列）
  "1日所定時間",
  "月出勤日数",
  "月平均出勤日数",
  "週所定日数",
  "年所定日数",
  // 勤怠（11 列）
  "出勤日数",
  "欠勤日数",
  "遅刻回数",
  "早退回数",
  "所定労働時間",
  "残業時間",
  "深夜時間",
  "有休日数",
  "研修時間",
  "事務時間",
  "総労働時間",
  // 支給_月給（16 列）
  "役員報酬(月給)",
  "基本給(月給)",
  "残業手当(月給)",
  "通勤手当_課税(月給)",
  "通勤手当_非課税(月給)",
  "深夜手当(月給)",
  "固定残業(月給)",
  "有休手当(月給)",
  "出張手当(月給)",
  "住宅手当(月給)",
  "役職手当(月給)",
  "家族手当(月給)",
  "資格手当(月給)",
  "その他手当1(月給)",
  "その他手当2(月給)",
  "その他手当3(月給)",
  // 支給_時給（11 列）
  "基本給(時給)",
  "AP インセン(時給)",
  "研修手当(時給)",
  "事務手当(時給)",
  "残業手当(時給)",
  "深夜手当(時給)",
  "休日手当(時給)",
  "社長賞インセン(時給)",
  "件数インセン(時給)",
  "通勤手当_課税(時給)",
  "通勤手当_非課税(時給)",
  // 支給_日給（7 列）
  "基本給(日給)",
  "残業手当(日給)",
  "深夜手当(日給)",
  "休日手当(日給)",
  "有休手当(日給)",
  "通勤手当_課税(日給)",
  "通勤手当_非課税(日給)",
  // 控除（12 列）
  "健保",
  "介護",
  "厚年",
  "雇保",
  "所得税",
  "住民税",
  "楽天早トク前払",
  "社宅家賃",
  "年調過不足",
  "その他控除1",
  "その他控除2",
  "その他控除3",
  // 備考（1 列）
  "備考",
];

if (MFC_CSV_COLUMN_HEADERS.length !== 72) {
  throw new Error(
    `MFC_CSV_COLUMN_HEADERS must have 72 columns, got: ${MFC_CSV_COLUMN_HEADERS.length}`,
  );
}

// ============================================================
// MfcCsvRow → 値配列の順序（COLUMN_HEADERS と 1:1 対応）
// ============================================================

export function rowToValues(row: MfcCsvRow): unknown[] {
  return [
    // 識別
    row.version,
    row.employeeIdentifier,
    row.employeeNumber,
    row.lastName,
    row.firstName,
    // 所属
    row.officeName,
    row.departmentName,
    row.jobTitle,
    row.contractType,
    // 所定
    row.dailyWorkingHours,
    row.monthlyWorkingDays,
    row.monthlyAvgWorkingDays,
    row.weeklyWorkingDays,
    row.yearlyWorkingDays,
    // 勤怠
    row.attendanceDays,
    row.absentDays,
    row.lateCount,
    row.earlyLeaveCount,
    row.scheduledWorkingHours,
    row.overtimeHours,
    row.lateNightHours,
    row.paidLeaveDays,
    row.trainingHours,
    row.officeWorkHours,
    row.totalWorkingHours,
    // 支給_月給
    row.monthlyExecutiveAllowance,
    row.monthlyBasicPay,
    row.monthlyOvertimePay,
    row.monthlyCommutingTaxable,
    row.monthlyCommutingNonTaxable,
    row.monthlyLateNightPay,
    row.monthlyFixedOvertime,
    row.monthlyPaidLeavePay,
    row.monthlyBusinessTripAllowance,
    row.monthlyHousingAllowance,
    row.monthlyPositionAllowance,
    row.monthlyFamilyAllowance,
    row.monthlyQualificationAllowance,
    row.monthlyOtherAllowance1,
    row.monthlyOtherAllowance2,
    row.monthlyOtherAllowance3,
    // 支給_時給
    row.hourlyBasicPay,
    row.hourlyApIncentive,
    row.hourlyTrainingPay,
    row.hourlyOfficeWorkPay,
    row.hourlyOvertimePay,
    row.hourlyLateNightPay,
    row.hourlyHolidayPay,
    row.hourlyPresidentIncentive,
    row.hourlyCaseIncentive,
    row.hourlyCommutingTaxable,
    row.hourlyCommutingNonTaxable,
    // 支給_日給
    row.dailyBasicPay,
    row.dailyOvertimePay,
    row.dailyLateNightPay,
    row.dailyHolidayPay,
    row.dailyPaidLeavePay,
    row.dailyCommutingTaxable,
    row.dailyCommutingNonTaxable,
    // 控除
    row.healthInsurance,
    row.longTermCareInsurance,
    row.welfarePension,
    row.employmentInsurance,
    row.withholdingTax,
    row.residentTax,
    row.rakutenAdvancePayment,
    row.housingRent,
    row.yearEndAdjustment,
    row.otherDeduction1,
    row.otherDeduction2,
    row.otherDeduction3,
    // 備考
    row.notes,
  ];
}

// ============================================================
// セルフォーマット
// ============================================================

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const s = String(value);
  if (s.includes(",") || s.includes("\n") || s.includes("\r") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ============================================================
// 行 → CSV 文字列
// ============================================================

export function rowToCsvLine(row: MfcCsvRow): string {
  return rowToValues(row).map(formatCell).join(",");
}

// ============================================================
// 全体生成: ヘッダ行 + データ行群 → cp932 Buffer
// ============================================================

export interface EncodedMfcCsv {
  /** cp932 でエンコードされた CSV Buffer（Storage upload 用）*/
  buffer: Buffer;
  /** 元の UTF-8 文字列（テスト・デバッグ用、通常は buffer のみ使用）*/
  utf8Text: string;
  /** 行数（ヘッダ含む）*/
  totalLines: number;
  /** バイト数 */
  byteSize: number;
}

/**
 * 72 列 MfcCsvRow 配列を cp932 + CRLF の CSV にエンコード。
 * 呼び出し側は buffer を Storage に upload + checksum 計算。
 */
export function encodeMfcCsv(rows: MfcCsvRow[]): EncodedMfcCsv {
  const headerLine = MFC_CSV_COLUMN_HEADERS.map(formatCell).join(",");
  const dataLines = rows.map((row) => rowToCsvLine(row));
  const allLines = [headerLine, ...dataLines];
  const utf8Text = allLines.join("\r\n") + "\r\n";

  const buffer = iconv.encode(utf8Text, "cp932");

  return {
    buffer,
    utf8Text,
    totalLines: allLines.length,
    byteSize: buffer.length,
  };
}
