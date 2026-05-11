/**
 * Garden-Bud / Phase D #11 MFC 互換 CSV 出力 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md
 * 対応 migration: supabase/migrations/20260507000007_bud_phase_d11_mfc_csv_export.sql
 * 正本: memory project_mfc_payroll_csv_format.md（72 列定義）
 *
 * Cat 4 #27 反映: MFC CSV 出力 = 振込ファイル生成と同時（exportPayrollBatchHybrid）。
 * 4 次 follow-up: status 7 段階（visual_double_checked 含む）。
 */

// ============================================================
// 列挙型
// ============================================================

export const MFC_CSV_STATUSES = [
  "draft",
  "approved",
  "exported",
  "confirmed_by_auditor",
  "visual_double_checked", // 4 次 follow-up
  "confirmed_by_sharoshi",
  "imported_to_mfc",
] as const;
export type MfcCsvStatus = (typeof MFC_CSV_STATUSES)[number];

export const MFC_GENERATOR_ROLES = [
  "payroll_calculator",
  "payroll_disburser",
] as const;
export type MfcGeneratorRole = (typeof MFC_GENERATOR_ROLES)[number];

/** 賃金形態（72 列のうち、形態によって埋める列が異なる）*/
export const PAYMENT_TYPES = ["monthly", "hourly", "daily"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

// ============================================================
// 9 カテゴリ列構成（spec §2.2 反映）
// ============================================================

export const MFC_CSV_CATEGORIES = [
  "識別", // 列 1-5（5 列）
  "所属", // 列 6-9（4 列）
  "所定", // 列 10-14（5 列）
  "勤怠", // 列 15-25（11 列）
  "支給_月給", // 列 26-41（16 列）
  "支給_時給", // 列 42-52（11 列）
  "支給_日給", // 列 53-59（7 列）
  "控除", // 列 60-71（12 列）
  "備考", // 列 72（1 列）
] as const;
export type MfcCsvCategory = (typeof MFC_CSV_CATEGORIES)[number];

/** 9 カテゴリ別の列数 */
export const MFC_CSV_CATEGORY_COL_COUNTS: Record<MfcCsvCategory, number> = {
  識別: 5,
  所属: 4,
  所定: 5,
  勤怠: 11,
  支給_月給: 16,
  支給_時給: 11,
  支給_日給: 7,
  控除: 12,
  備考: 1,
};

/** 合計列数 = 5+4+5+11+16+11+7+12+1 = 72 */
export const MFC_CSV_TOTAL_COLUMNS = 72;

// ============================================================
// 72 列マッパー入力（DB から呼び出し側で組み立て）
// ============================================================

/**
 * 72 列マッピング入力。実際の MFC サンプル CSV と memory project_mfc_payroll_csv_format.md
 * を正本として、本 interface は実装の起点となる代表フィールドを定義。
 * 全 72 列の完全マッピングは実装フェーズで spec § 4 と memory を 1:1 比較で確定。
 */
export interface MfcCsvRow {
  // 識別（5 列）
  version: string;
  employeeIdentifier: string; // MFC 内部 ID
  employeeNumber: string; // 社員番号
  lastName: string;
  firstName: string;

  // 所属（4 列）
  officeName: string;
  departmentName: string;
  jobTitle: string;
  contractType: string;

  // 所定（5 列）
  dailyWorkingHours: number; // 1 日所定時間（時間単位の小数）
  monthlyWorkingDays: number;
  monthlyAvgWorkingDays: number;
  weeklyWorkingDays: number;
  yearlyWorkingDays: number;

  // 勤怠（11 列、平日）
  attendanceDays: number;
  absentDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  scheduledWorkingHours: number;
  overtimeHours: number;
  lateNightHours: number;
  paidLeaveDays: number;
  trainingHours: number;
  officeWorkHours: number;
  totalWorkingHours: number;

  // 支給_月給（16 列、monthly のみ非空）
  monthlyExecutiveAllowance: number;
  monthlyBasicPay: number;
  monthlyOvertimePay: number;
  monthlyCommutingTaxable: number;
  monthlyCommutingNonTaxable: number;
  monthlyLateNightPay: number;
  monthlyFixedOvertime: number;
  monthlyPaidLeavePay: number;
  monthlyBusinessTripAllowance: number;
  monthlyHousingAllowance: number;
  monthlyPositionAllowance: number;
  monthlyFamilyAllowance: number;
  monthlyQualificationAllowance: number;
  monthlyOtherAllowance1: number;
  monthlyOtherAllowance2: number;
  monthlyOtherAllowance3: number;

  // 支給_時給（11 列、hourly のみ非空、インセン 3 種含む）
  hourlyBasicPay: number;
  hourlyApIncentive: number; // AP インセン（D-10 計算結果から）
  hourlyTrainingPay: number;
  hourlyOfficeWorkPay: number;
  hourlyOvertimePay: number;
  hourlyLateNightPay: number;
  hourlyHolidayPay: number;
  hourlyPresidentIncentive: number; // 社長賞インセン
  hourlyCaseIncentive: number; // 件数インセン
  hourlyCommutingTaxable: number;
  hourlyCommutingNonTaxable: number;

  // 支給_日給（7 列、daily のみ非空）
  dailyBasicPay: number;
  dailyOvertimePay: number;
  dailyLateNightPay: number;
  dailyHolidayPay: number;
  dailyPaidLeavePay: number;
  dailyCommutingTaxable: number;
  dailyCommutingNonTaxable: number;

  // 控除（12 列）
  healthInsurance: number;
  longTermCareInsurance: number;
  welfarePension: number;
  employmentInsurance: number;
  withholdingTax: number;
  residentTax: number;
  rakutenAdvancePayment: number; // 楽天早トク前払
  housingRent: number; // 社宅家賃
  yearEndAdjustment: number; // 年調過不足
  otherDeduction1: number;
  otherDeduction2: number;
  otherDeduction3: number;

  // 備考（1 列）
  notes: string;
}

// ============================================================
// マッパーコンテキスト
// ============================================================

export interface MfcMapperContext {
  /** 給与結果（D-02 結果転記 + D-10 インセン）*/
  payrollRecord: {
    employeeId: string;
    grossPay: number;
    basicPay: number;
    overtimePay: number;
    lateNightPay: number;
    holidayPay: number;
    legalOvertimePay: number;
    commuteAllowance: number;
    healthInsurance: number;
    longTermCareInsurance: number;
    welfarePension: number;
    employmentInsurance: number;
    withholdingTax: number;
    residentTax: number;
    paymentType: PaymentType;
    apIncentive: number;
    presidentIncentive: number;
    caseIncentive: number;
  };
  /** 従業員（root_employees）*/
  employee: {
    id: string;
    employeeNumber: string;
    lastName: string;
    firstName: string;
    departmentName: string;
    jobTitle: string;
    contractType: string;
    mfcInternalId: string; // MFC 連携用 ID
  };
  /** 法人（root_companies）*/
  company: {
    id: string;
    officeName: string;
  };
  /** 給与体系（root_salary_systems 想定）*/
  salarySystem: {
    paymentType: PaymentType;
    dailyWorkingHours: number;
    monthlyScheduledMinutes: number;
    monthlyAvgWorkingDays: number;
    weeklyWorkingDays: number;
    yearlyWorkingDays: number;
    hourlyRate: number | null;
    dailyRate: number | null;
  };
  /** 勤怠（D-01 snapshot）*/
  attendance: {
    attendanceDays: number;
    absentDays: number;
    lateCount: number;
    earlyLeaveCount: number;
    scheduledWorkingMinutes: number;
    overtimeMinutes: number;
    lateNightMinutes: number;
    paidLeaveDays: number;
    trainingMinutes: number;
    officeWorkMinutes: number;
    actualWorkingMinutes: number;
  };
  /** 通勤手当 課税/非課税分離 */
  commute: {
    taxable: number;
    nonTaxable: number;
  };
  /** 楽天早トク前払（手入力、Phase E で自動化）*/
  rakutenAdvancePayment: number;
  /** 社宅家賃（個別控除から）*/
  housingRent: number;
  /** 年調過不足（D-06 連動）*/
  yearEndAdjustment: number;
  /** その他控除（個別 3 列まで対応）*/
  otherDeductions: [number, number, number];
}
