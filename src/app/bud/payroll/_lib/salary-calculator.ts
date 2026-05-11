/**
 * Garden-Bud / Phase D #02 給与計算（純関数）
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-02-salary-calculation.md
 *
 * 純関数のみ。DB アクセスなし、Server Action / Cron からは
 * DB アクセス済の入力を渡して呼ぶ想定。
 *
 * 計算順:
 *   1. 基本給（月給 / 時給 / 業務委託）
 *   2. 割増（残業 25% / 60h 超 50% / 深夜 25% / 法定休日 35% / 法定外休日 25%）
 *   3. 手当合計
 *   4. 欠勤・遅刻・早退控除
 *   5. 総支給額（gross_pay）
 *   6. 課税対象額の算出（手取り計算用）
 *   7. 源泉徴収税額（甲: 月額表 + 扶養 / 乙: flat + rate）
 *   8. 住民税（6 月だけ別額）
 *   9. 個別控除合計
 *   10. 純支給額（net_pay）
 *
 * 端数処理:
 *   - 給与額: 1 円未満切り捨て（Math.floor）
 *   - 残業時給ベース: numeric として保持、最終 floor
 *   - 税額: 1 円未満切り捨て（Math.floor）
 */

import {
  type SalaryCalculationInput,
  type SalaryCalculationResult,
  type OvertimeBreakdown,
  type AbsentLateBreakdown,
  type WithholdingTaxLookupInput,
  type WithholdingTaxTableKouRow,
  type WithholdingTaxTableOtsuRow,
  type BudResidentTaxAssignment,
  DEPENDENTS_OVER_7_DEDUCTION_PER_PERSON,
  OVERTIME_REGULAR_RATE,
  OVERTIME_EXCESS_ADDITIONAL_RATE,
  OVERTIME_EXCESS_THRESHOLD_MINUTES,
  LATE_NIGHT_RATE,
  HOLIDAY_RATE,
  LEGAL_OVERTIME_RATE,
} from "./salary-types";

// ============================================================
// 1. 基本給計算
// ============================================================

/**
 * 月給制の基本給（欠勤控除前の額）
 * 月給制では入社月・退職月の按分は呼び出し側で実施（calendarDays / workingDays 反映済を期待）。
 */
export function calculateMonthlyBasicPay(
  monthlyBasePay: number,
  /** 出勤日数（按分用、フル出勤想定なら monthlyScheduledDays と一致）*/
  workingDays: number,
  /** 月所定出勤日数（按分の分母、暦日数ではなく所定日数）*/
  monthlyScheduledDays: number,
): number {
  if (monthlyScheduledDays <= 0) return 0;
  if (workingDays >= monthlyScheduledDays) return monthlyBasePay;
  // 月途中入社・退職時の按分
  return Math.floor((monthlyBasePay * workingDays) / monthlyScheduledDays);
}

/**
 * 時給制の基本給
 * actualWorkingMinutes は所定労働分のみ（残業は除外、別途割増で計算）。
 */
export function calculateHourlyBasicPay(
  hourlyRate: number,
  actualWorkingMinutes: number,
): number {
  if (hourlyRate <= 0 || actualWorkingMinutes <= 0) return 0;
  return Math.floor((hourlyRate * actualWorkingMinutes) / 60);
}

// ============================================================
// 2. 時給単価（割増の基礎）
// ============================================================

/**
 * 月給制の時給単価（割増計算の基礎額）
 * 単価 = 月給 ÷ 月所定労働時間（分）× 60
 */
export function calculateBaseHourlyRate(
  monthlyBasePay: number,
  monthlyScheduledMinutes: number,
): number {
  if (monthlyScheduledMinutes <= 0) return 0;
  return (monthlyBasePay * 60) / monthlyScheduledMinutes;
}

// ============================================================
// 3. 割増賃金
// ============================================================

export function calculateOvertime(
  baseHourlyRate: number,
  input: {
    overtimeMinutes: number;
    lateNightMinutes: number;
    holidayWorkingMinutes: number;
    legalOvertimeMinutes: number;
  },
): OvertimeBreakdown {
  // 通常残業（月 60h 以下分は 25%、60h 超分は追加 25% で合計 50%）
  const regularPart = Math.min(input.overtimeMinutes, OVERTIME_EXCESS_THRESHOLD_MINUTES);
  const excessPart = Math.max(input.overtimeMinutes - OVERTIME_EXCESS_THRESHOLD_MINUTES, 0);

  // 通常残業 = 単価 × (1 + 0.25) × 時間
  const regularOvertimePay = Math.floor(
    (baseHourlyRate * (regularPart / 60) * (1 + OVERTIME_REGULAR_RATE)),
  );
  // 60h 超 残業 = 単価 × (1 + 0.5) × 時間（= 1 + 0.25 + 0.25）
  const excessOvertimePay = Math.floor(
    (baseHourlyRate *
      (excessPart / 60) *
      (1 + OVERTIME_REGULAR_RATE + OVERTIME_EXCESS_ADDITIONAL_RATE)),
  );

  // 深夜労働（時間外と重複可能、ここでは深夜 25% のみ加算）
  // 注: 残業と深夜が重複する場合の追加 25% は呼び出し側 spec で判定すべきだが、
  // シンプルなケースとして本ロジックでは深夜分単独で 1.25 倍とする
  const lateNightPay = Math.floor(
    (baseHourlyRate * (input.lateNightMinutes / 60) * (1 + LATE_NIGHT_RATE)),
  );

  // 法定休日労働（35%）
  const holidayPay = Math.floor(
    (baseHourlyRate * (input.holidayWorkingMinutes / 60) * (1 + HOLIDAY_RATE)),
  );

  // 法定外休日労働（通常残業と同じ 25%）
  const legalOvertimePay = Math.floor(
    (baseHourlyRate * (input.legalOvertimeMinutes / 60) * (1 + LEGAL_OVERTIME_RATE)),
  );

  return {
    regularOvertimePay,
    excessOvertimePay,
    lateNightPay,
    holidayPay,
    legalOvertimePay,
    total: regularOvertimePay + excessOvertimePay + lateNightPay + holidayPay + legalOvertimePay,
  };
}

// ============================================================
// 4. 欠勤・遅刻・早退控除
// ============================================================

export function calculateAbsentLateDeduction(input: {
  monthlyBasePay: number;
  /** 暦日数（欠勤控除の分母、暦上の月日数）*/
  calendarDays: number;
  /** 月所定労働時間（分、遅刻早退控除の分母）*/
  monthlyScheduledMinutes: number;
  absentDays: number;
  lateMinutesTotal: number;
  earlyLeaveMinutesTotal: number;
}): AbsentLateBreakdown {
  // 欠勤控除 = 基本給 / 暦日数 × 欠勤日数
  const absentDeduction =
    input.calendarDays > 0
      ? Math.floor((input.monthlyBasePay * input.absentDays) / input.calendarDays)
      : 0;

  // 遅刻早退控除 = 基本給 / 月所定労働分 × 遅刻早退分
  const perMinuteRate =
    input.monthlyScheduledMinutes > 0
      ? input.monthlyBasePay / input.monthlyScheduledMinutes
      : 0;
  const lateDeduction = Math.floor(perMinuteRate * input.lateMinutesTotal);
  const earlyLeaveDeduction = Math.floor(perMinuteRate * input.earlyLeaveMinutesTotal);

  return {
    absentDeduction,
    lateDeduction,
    earlyLeaveDeduction,
    total: absentDeduction + lateDeduction + earlyLeaveDeduction,
  };
}

// ============================================================
// 5. 月次給与の総支給額（gross_pay）計算
// ============================================================

/**
 * 月次給与計算の総合エントリポイント。
 * 基本給 + 割増 + 手当 - 欠勤控除 = grossPay。
 */
export function calculateMonthlySalary(
  input: SalaryCalculationInput,
): SalaryCalculationResult {
  // 基本給
  let basicPay = 0;
  let baseHourlyRate = 0;

  if (input.baseCalculationMethod === "monthly") {
    basicPay = input.monthlyBasePay;
    baseHourlyRate = calculateBaseHourlyRate(
      input.monthlyBasePay,
      input.monthlyScheduledMinutes,
    );
  } else if (input.baseCalculationMethod === "hourly") {
    basicPay = calculateHourlyBasicPay(input.hourlyRate ?? 0, input.actualWorkingMinutes);
    baseHourlyRate = input.hourlyRate ?? 0;
  } else {
    // commission（業務委託）→ 給与計算対象外
    return {
      basicPay: 0,
      overtime: {
        regularOvertimePay: 0,
        excessOvertimePay: 0,
        lateNightPay: 0,
        holidayPay: 0,
        legalOvertimePay: 0,
        total: 0,
      },
      absentLate: { absentDeduction: 0, lateDeduction: 0, earlyLeaveDeduction: 0, total: 0 },
      totalAllowances: 0,
      grossPay: 0,
    };
  }

  // 割増
  const overtime = calculateOvertime(baseHourlyRate, {
    overtimeMinutes: input.overtimeMinutes,
    lateNightMinutes: input.lateNightMinutes,
    holidayWorkingMinutes: input.holidayWorkingMinutes,
    legalOvertimeMinutes: input.legalOvertimeMinutes,
  });

  // 欠勤・遅刻・早退控除
  const absentLate =
    input.baseCalculationMethod === "monthly"
      ? calculateAbsentLateDeduction({
          monthlyBasePay: input.monthlyBasePay,
          calendarDays: input.calendarDays,
          monthlyScheduledMinutes: input.monthlyScheduledMinutes,
          absentDays: input.absentDays,
          lateMinutesTotal: input.lateMinutesTotal,
          earlyLeaveMinutesTotal: input.earlyLeaveMinutesTotal,
        })
      : { absentDeduction: 0, lateDeduction: 0, earlyLeaveDeduction: 0, total: 0 };
  // 時給制は実労働時間ベースなので欠勤控除の概念なし（actualWorkingMinutes に既反映）

  // 総支給額
  const grossPay =
    basicPay + overtime.total + input.allowances.total - absentLate.total;

  return {
    basicPay,
    overtime,
    absentLate,
    totalAllowances: input.allowances.total,
    grossPay: Math.max(grossPay, 0), // 念のため負数防止
  };
}

// ============================================================
// 6. 源泉徴収税額のルックアップ
// ============================================================

/**
 * 月額表 甲欄から源泉徴収税額を引く。
 * 扶養 0-7 人は表の値、7 人超は dependents_7 から
 * （dependentsCount - 7）× 1,610 円を減算。
 */
function lookupKouTax(
  table: WithholdingTaxTableKouRow[],
  taxableAmount: number,
  dependentsCount: number,
): number | null {
  // taxableMin <= taxableAmount < taxableMax
  const row = table.find(
    (r) => taxableAmount >= r.taxableMin && taxableAmount < r.taxableMax,
  );
  if (!row) return null;

  if (dependentsCount <= 7) {
    const key = `dependents${dependentsCount}` as
      | "dependents0"
      | "dependents1"
      | "dependents2"
      | "dependents3"
      | "dependents4"
      | "dependents5"
      | "dependents6"
      | "dependents7";
    return row[key];
  }

  // 7 人超
  const baseTax = row.dependents7;
  const reduction = (dependentsCount - 7) * DEPENDENTS_OVER_7_DEDUCTION_PER_PERSON;
  return Math.max(baseTax - reduction, 0);
}

/**
 * 月額表 乙欄から源泉徴収税額を引く。
 * 税額 = flatAmount + (taxableAmount - taxableMin) × taxRate
 */
function lookupOtsuTax(
  table: WithholdingTaxTableOtsuRow[],
  taxableAmount: number,
): number | null {
  const row = table.find(
    (r) => taxableAmount >= r.taxableMin && taxableAmount < r.taxableMax,
  );
  if (!row) return null;
  return Math.floor(row.flatAmount + (taxableAmount - row.taxableMin) * row.taxRate);
}

/**
 * 源泉徴収税額の総合 lookup。
 * @returns 税額（円）、表に該当行がない場合 null（呼び出し側でエラー扱い）
 */
export function lookupWithholdingTax(
  input: WithholdingTaxLookupInput,
): number | null {
  if (input.taxableAmount < 0) return 0;

  if (input.kouOtsu === "kou") {
    if (input.dependentsCount < 0) return null;
    return lookupKouTax(input.kouTable, input.taxableAmount, input.dependentsCount);
  } else {
    return lookupOtsuTax(input.otsuTable, input.taxableAmount);
  }
}

/**
 * 課税対象額の算出。
 * 課税対象額 = grossPay - 非課税通勤手当 - 健保 - 厚年 - 雇用 - 介護
 */
export function calculateTaxableAmount(input: {
  grossPay: number;
  /** 通勤手当の非課税分（月 15 万円までが非課税）*/
  nonTaxableCommuteAllowance: number;
  /** 社会保険料合計（健保 + 厚年 + 介護 + 雇用、従業員負担分）*/
  totalSocialInsurance: number;
}): number {
  return Math.max(
    input.grossPay - input.nonTaxableCommuteAllowance - input.totalSocialInsurance,
    0,
  );
}

// ============================================================
// 7. 住民税の月額決定
// ============================================================

/**
 * 住民税の月額を決定。
 * 6 月のみ juneAmount、7 月-翌 5 月は monthlyAmount。
 * fiscal_year は 6 月-翌 5 月の年度（例: 2026/6/1 - 2027/5/31 → 2026）。
 *
 * @param paymentMonth 1-12（給与の支給月）
 * @param paymentYear 支給年（fiscal_year 検索用）
 * @param assignment 該当年度の住民税アサイン
 */
export function decideResidentTax(
  paymentMonth: number,
  paymentYear: number,
  assignment: BudResidentTaxAssignment,
): number {
  // 6 月以前は前年度の fiscal_year、7 月以降は当年度の fiscal_year に属する
  // 例: 2026 年 5 月 → fiscal_year=2025（2025/6 - 2026/5）
  //     2026 年 6 月 → fiscal_year=2026（2026/6 - 2027/5）
  const expectedFiscalYear = paymentMonth >= 6 ? paymentYear : paymentYear - 1;
  if (assignment.fiscalYear !== expectedFiscalYear) {
    // 不整合（呼び出し側責任）
    return 0;
  }
  return paymentMonth === 6 ? assignment.juneAmount : assignment.monthlyAmount;
}

// ============================================================
// 8. 個別手当の effective 期間フィルタリング
// ============================================================

interface DateRanged {
  effectiveFrom: string;
  effectiveTo: string | null;
}

/**
 * effective 期間内のレコードのみを返す。
 * paymentDate は YYYY-MM-DD 形式の文字列（lexicographic 比較で十分）。
 */
export function filterEffectiveAtDate<T extends DateRanged>(
  records: T[],
  paymentDate: string,
): T[] {
  return records.filter(
    (r) =>
      r.effectiveFrom <= paymentDate &&
      (r.effectiveTo === null || r.effectiveTo >= paymentDate),
  );
}

// ============================================================
// 9. 純支給額（net_pay）計算
// ============================================================

export interface NetPayInput {
  grossPay: number;
  /** 社会保険料合計（D-05 結果）*/
  totalSocialInsurance: number;
  /** 源泉徴収税額 */
  withholdingTax: number;
  /** 住民税 */
  residentTax: number;
  /** その他控除合計（個別控除）*/
  totalOtherDeductions: number;
}

export interface NetPayResult {
  totalDeductions: number;
  netPay: number;
}

export function calculateNetPay(input: NetPayInput): NetPayResult {
  const totalDeductions =
    input.totalSocialInsurance +
    input.withholdingTax +
    input.residentTax +
    input.totalOtherDeductions;
  return {
    totalDeductions,
    netPay: input.grossPay - totalDeductions,
  };
}
