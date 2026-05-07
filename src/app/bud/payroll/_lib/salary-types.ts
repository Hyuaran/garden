/**
 * Garden-Bud / Phase D #02 給与計算 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md
 * 対応 migration: supabase/migrations/20260507000004_bud_phase_d02_salary_calculation.sql
 */

// ============================================================
// 列挙型
// ============================================================

export const BASE_CALCULATION_METHODS = ["monthly", "hourly", "commission"] as const;
export type BaseCalculationMethod = (typeof BASE_CALCULATION_METHODS)[number];

export const ALLOWANCE_TYPES = [
  "commute",
  "housing",
  "position",
  "family",
  "qualification",
  "custom",
] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPES)[number];

export const SALARY_RECORD_STATUSES = [
  "calculated",
  "approved",
  "paid",
  "cancelled",
] as const;
export type SalaryRecordStatus = (typeof SALARY_RECORD_STATUSES)[number];

export type KouOtsu = "kou" | "otsu";

// ============================================================
// 月額表 甲欄（扶養 0-7 人）
// ============================================================

export interface WithholdingTaxTableKouRow {
  id: string;
  effectiveYear: number;
  taxableMin: number;
  taxableMax: number;
  dependents0: number;
  dependents1: number;
  dependents2: number;
  dependents3: number;
  dependents4: number;
  dependents5: number;
  dependents6: number;
  dependents7: number;
}

// ============================================================
// 月額表 乙欄
// ============================================================

export interface WithholdingTaxTableOtsuRow {
  id: string;
  effectiveYear: number;
  taxableMin: number;
  taxableMax: number;
  taxRate: number; // 例: 0.1063
  flatAmount: number;
}

// ============================================================
// 個別手当・控除上書き
// ============================================================

export interface BudEmployeeAllowance {
  id: string;
  employeeId: string;
  allowanceType: AllowanceType;
  customLabel: string | null; // allowance_type='custom' 時のみ
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface BudEmployeeDeduction {
  id: string;
  employeeId: string;
  deductionLabel: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

// ============================================================
// 住民税アサイン
// ============================================================

export interface BudResidentTaxAssignment {
  id: string;
  employeeId: string;
  fiscalYear: number; // 6 月-翌 5 月の年度
  juneAmount: number; // 6 月のみ別額
  monthlyAmount: number; // 7 月-翌 5 月共通
  sourceMunicipality: string | null;
  notes: string | null;
}

// ============================================================
// 計算入力（純関数の入力）
// ============================================================

export interface AllowanceBreakdown {
  commute: number;
  housing: number;
  position: number;
  family: number;
  qualification: number;
  custom: Record<string, number>; // { "営業手当": 30000, ... }
  total: number;
}

export interface OvertimeBreakdown {
  /** 通常残業（月 60h 以下、25%）*/
  regularOvertimePay: number;
  /** 月 60h 超 残業（追加 25% 分のみ、合計 50%）*/
  excessOvertimePay: number;
  /** 深夜労働（22:00-5:00、25%）*/
  lateNightPay: number;
  /** 法定休日労働（35%）*/
  holidayPay: number;
  /** 法定外休日労働（25%、通常残業と同じ扱い）*/
  legalOvertimePay: number;
  /** 合計 */
  total: number;
}

export interface AbsentLateBreakdown {
  /** 欠勤控除 */
  absentDeduction: number;
  /** 遅刻控除 */
  lateDeduction: number;
  /** 早退控除 */
  earlyLeaveDeduction: number;
  total: number;
}

export interface SalaryCalculationInput {
  /** 基本給算出方法 */
  baseCalculationMethod: BaseCalculationMethod;
  /** 月給制基本給（円、monthly のみ）*/
  monthlyBasePay: number;
  /** 時給（円、hourly のみ）*/
  hourlyRate: number | null;
  /** 月所定労働時間（分、monthly のみ）*/
  monthlyScheduledMinutes: number;
  /** 暦日数（月途中入社・退職・欠勤計算用）*/
  calendarDays: number;
  /** 出勤日数（hourly でも参照、欠勤計算で使う）*/
  workingDays: number;
  /** 実労働時間（分、hourly の基本給計算 + 全形態の割増基礎）*/
  actualWorkingMinutes: number;
  /** 残業時間（分）*/
  overtimeMinutes: number;
  /** 深夜労働時間（分）*/
  lateNightMinutes: number;
  /** 法定休日労働（分）*/
  holidayWorkingMinutes: number;
  /** 法定外休日労働（分）*/
  legalOvertimeMinutes: number;
  /** 欠勤日数 */
  absentDays: number;
  /** 遅刻時間合計（分）*/
  lateMinutesTotal: number;
  /** 早退時間合計（分）*/
  earlyLeaveMinutesTotal: number;
  /** 個別手当（commute / housing / etc.）*/
  allowances: AllowanceBreakdown;
}

// ============================================================
// 計算結果
// ============================================================

export interface SalaryCalculationResult {
  /** 基本給（円、欠勤控除前の額）*/
  basicPay: number;
  /** 残業・深夜・休日割増 */
  overtime: OvertimeBreakdown;
  /** 欠勤・遅刻・早退控除 */
  absentLate: AbsentLateBreakdown;
  /** 手当合計 */
  totalAllowances: number;
  /** 総支給額 = basicPay + overtime.total + totalAllowances - absentLate.total */
  grossPay: number;
}

// ============================================================
// 源泉徴収税額の計算
// ============================================================

export interface WithholdingTaxLookupInput {
  /** 課税対象額（gross_pay - 通勤手当(非課税) - 社保合計）*/
  taxableAmount: number;
  /** 甲乙区分 */
  kouOtsu: KouOtsu;
  /** 扶養親族数 */
  dependentsCount: number;
  /** 月額表（甲乙どちらか必要、null は呼び出し側で判定）*/
  kouTable: WithholdingTaxTableKouRow[];
  otsuTable: WithholdingTaxTableOtsuRow[];
}

// ============================================================
// 端数処理 / 法令定数
// ============================================================

/** 7 人超の扶養家族 1 人ごとの月額表 甲 減算額（円）*/
export const DEPENDENTS_OVER_7_DEDUCTION_PER_PERSON = 1_610;

/** 通常残業 割増率（25%、上乗せ部分）*/
export const OVERTIME_REGULAR_RATE = 0.25;

/** 月 60 時間超 残業 追加割増率（追加 25%、合計 50%）*/
export const OVERTIME_EXCESS_ADDITIONAL_RATE = 0.25;

/** 月 60 時間超 残業の閾値（分単位、60 時間 = 3600 分）*/
export const OVERTIME_EXCESS_THRESHOLD_MINUTES = 60 * 60;

/** 深夜労働 割増率（25%、上乗せ部分）*/
export const LATE_NIGHT_RATE = 0.25;

/** 法定休日労働 割増率（35%、上乗せ部分）*/
export const HOLIDAY_RATE = 0.35;

/** 法定外休日労働 割増率（25%、通常残業と同じ）*/
export const LEGAL_OVERTIME_RATE = 0.25;
