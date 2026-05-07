/**
 * Garden-Bud / Phase D #11 MFC 互換 CSV マッパー（純関数）
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-11-mfc-csv-export.md §4
 * 正本: memory project_mfc_payroll_csv_format.md（72 列定義）
 *
 * 純関数のみ。`bud_salary_records` + `root_employees` + `root_companies` +
 * `bud_payroll_attendance_snapshots` を結合済の context を入力として受け取り、
 * 72 列の MfcCsvRow を出力する。
 *
 * 形態別ロジック（spec §2.3）:
 *   - monthly: 列 26-41（月給）を埋め、列 42-52（時給）/ 53-59（日給）は 0
 *   - hourly: 列 42-52（時給、インセン 3 種含む）を埋め、月給/日給は 0
 *   - daily: 列 53-59（日給）を埋め、月給/時給は 0
 */

import type {
  MfcCsvRow,
  MfcMapperContext,
  PaymentType,
} from "./mfc-csv-types";

// ============================================================
// ヘルパー: 分 → 時間（小数）
// ============================================================

function minutesToHours(minutes: number): number {
  return minutes / 60;
}

// ============================================================
// 形態別フィールドのゼロ初期化
// ============================================================

interface MonthlyFields {
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
}

interface HourlyFields {
  hourlyBasicPay: number;
  hourlyApIncentive: number;
  hourlyTrainingPay: number;
  hourlyOfficeWorkPay: number;
  hourlyOvertimePay: number;
  hourlyLateNightPay: number;
  hourlyHolidayPay: number;
  hourlyPresidentIncentive: number;
  hourlyCaseIncentive: number;
  hourlyCommutingTaxable: number;
  hourlyCommutingNonTaxable: number;
}

interface DailyFields {
  dailyBasicPay: number;
  dailyOvertimePay: number;
  dailyLateNightPay: number;
  dailyHolidayPay: number;
  dailyPaidLeavePay: number;
  dailyCommutingTaxable: number;
  dailyCommutingNonTaxable: number;
}

function emptyMonthlyFields(): MonthlyFields {
  return {
    monthlyExecutiveAllowance: 0,
    monthlyBasicPay: 0,
    monthlyOvertimePay: 0,
    monthlyCommutingTaxable: 0,
    monthlyCommutingNonTaxable: 0,
    monthlyLateNightPay: 0,
    monthlyFixedOvertime: 0,
    monthlyPaidLeavePay: 0,
    monthlyBusinessTripAllowance: 0,
    monthlyHousingAllowance: 0,
    monthlyPositionAllowance: 0,
    monthlyFamilyAllowance: 0,
    monthlyQualificationAllowance: 0,
    monthlyOtherAllowance1: 0,
    monthlyOtherAllowance2: 0,
    monthlyOtherAllowance3: 0,
  };
}

function emptyHourlyFields(): HourlyFields {
  return {
    hourlyBasicPay: 0,
    hourlyApIncentive: 0,
    hourlyTrainingPay: 0,
    hourlyOfficeWorkPay: 0,
    hourlyOvertimePay: 0,
    hourlyLateNightPay: 0,
    hourlyHolidayPay: 0,
    hourlyPresidentIncentive: 0,
    hourlyCaseIncentive: 0,
    hourlyCommutingTaxable: 0,
    hourlyCommutingNonTaxable: 0,
  };
}

function emptyDailyFields(): DailyFields {
  return {
    dailyBasicPay: 0,
    dailyOvertimePay: 0,
    dailyLateNightPay: 0,
    dailyHolidayPay: 0,
    dailyPaidLeavePay: 0,
    dailyCommutingTaxable: 0,
    dailyCommutingNonTaxable: 0,
  };
}

// ============================================================
// 形態別フィールド充填
// ============================================================

function fillMonthlyFields(ctx: MfcMapperContext): MonthlyFields {
  return {
    monthlyExecutiveAllowance: 0, // 役員報酬は別系統（root_employees.is_executive 連動、Phase D-10）
    monthlyBasicPay: ctx.payrollRecord.basicPay,
    monthlyOvertimePay: ctx.payrollRecord.overtimePay + ctx.payrollRecord.legalOvertimePay,
    monthlyCommutingTaxable: ctx.commute.taxable,
    monthlyCommutingNonTaxable: ctx.commute.nonTaxable,
    monthlyLateNightPay: ctx.payrollRecord.lateNightPay,
    monthlyFixedOvertime: 0, // 固定残業は契約により別管理
    monthlyPaidLeavePay: 0, // 有給は基本給に含む想定（呼び出し側で分離可）
    monthlyBusinessTripAllowance: 0,
    monthlyHousingAllowance: 0,
    monthlyPositionAllowance: 0,
    monthlyFamilyAllowance: 0,
    monthlyQualificationAllowance: 0,
    monthlyOtherAllowance1: 0,
    monthlyOtherAllowance2: 0,
    monthlyOtherAllowance3: 0,
  };
}

function fillHourlyFields(ctx: MfcMapperContext): HourlyFields {
  return {
    hourlyBasicPay: ctx.payrollRecord.basicPay,
    hourlyApIncentive: ctx.payrollRecord.apIncentive,
    hourlyTrainingPay: 0,
    hourlyOfficeWorkPay: 0,
    hourlyOvertimePay: ctx.payrollRecord.overtimePay,
    hourlyLateNightPay: ctx.payrollRecord.lateNightPay,
    hourlyHolidayPay: ctx.payrollRecord.holidayPay,
    hourlyPresidentIncentive: ctx.payrollRecord.presidentIncentive,
    hourlyCaseIncentive: ctx.payrollRecord.caseIncentive,
    hourlyCommutingTaxable: ctx.commute.taxable,
    hourlyCommutingNonTaxable: ctx.commute.nonTaxable,
  };
}

function fillDailyFields(ctx: MfcMapperContext): DailyFields {
  return {
    dailyBasicPay: ctx.payrollRecord.basicPay,
    dailyOvertimePay: ctx.payrollRecord.overtimePay,
    dailyLateNightPay: ctx.payrollRecord.lateNightPay,
    dailyHolidayPay: ctx.payrollRecord.holidayPay,
    dailyPaidLeavePay: 0,
    dailyCommutingTaxable: ctx.commute.taxable,
    dailyCommutingNonTaxable: ctx.commute.nonTaxable,
  };
}

// ============================================================
// 公開 API: context → MfcCsvRow への 72 列マッピング
// ============================================================

export function mapToMfcCsvRow(ctx: MfcMapperContext): MfcCsvRow {
  const paymentType: PaymentType = ctx.salarySystem.paymentType;

  // 形態別: 該当しない形態のフィールドはゼロで埋める
  const monthly = paymentType === "monthly" ? fillMonthlyFields(ctx) : emptyMonthlyFields();
  const hourly = paymentType === "hourly" ? fillHourlyFields(ctx) : emptyHourlyFields();
  const daily = paymentType === "daily" ? fillDailyFields(ctx) : emptyDailyFields();

  return {
    // 識別（5 列）
    version: "1.0",
    employeeIdentifier: ctx.employee.mfcInternalId,
    employeeNumber: ctx.employee.employeeNumber,
    lastName: ctx.employee.lastName,
    firstName: ctx.employee.firstName,

    // 所属（4 列）
    officeName: ctx.company.officeName,
    departmentName: ctx.employee.departmentName,
    jobTitle: ctx.employee.jobTitle,
    contractType: ctx.employee.contractType,

    // 所定（5 列）
    dailyWorkingHours: ctx.salarySystem.dailyWorkingHours,
    monthlyWorkingDays: ctx.attendance.attendanceDays,
    monthlyAvgWorkingDays: ctx.salarySystem.monthlyAvgWorkingDays,
    weeklyWorkingDays: ctx.salarySystem.weeklyWorkingDays,
    yearlyWorkingDays: ctx.salarySystem.yearlyWorkingDays,

    // 勤怠（11 列、平日）
    attendanceDays: ctx.attendance.attendanceDays,
    absentDays: ctx.attendance.absentDays,
    lateCount: ctx.attendance.lateCount,
    earlyLeaveCount: ctx.attendance.earlyLeaveCount,
    scheduledWorkingHours: minutesToHours(ctx.attendance.scheduledWorkingMinutes),
    overtimeHours: minutesToHours(ctx.attendance.overtimeMinutes),
    lateNightHours: minutesToHours(ctx.attendance.lateNightMinutes),
    paidLeaveDays: ctx.attendance.paidLeaveDays,
    trainingHours: minutesToHours(ctx.attendance.trainingMinutes),
    officeWorkHours: minutesToHours(ctx.attendance.officeWorkMinutes),
    totalWorkingHours: minutesToHours(ctx.attendance.actualWorkingMinutes),

    // 支給_月給（16 列）
    ...monthly,

    // 支給_時給（11 列、インセン 3 種含む）
    ...hourly,

    // 支給_日給（7 列）
    ...daily,

    // 控除（12 列）
    healthInsurance: ctx.payrollRecord.healthInsurance,
    longTermCareInsurance: ctx.payrollRecord.longTermCareInsurance,
    welfarePension: ctx.payrollRecord.welfarePension,
    employmentInsurance: ctx.payrollRecord.employmentInsurance,
    withholdingTax: ctx.payrollRecord.withholdingTax,
    residentTax: ctx.payrollRecord.residentTax,
    rakutenAdvancePayment: ctx.rakutenAdvancePayment,
    housingRent: ctx.housingRent,
    yearEndAdjustment: ctx.yearEndAdjustment,
    otherDeduction1: ctx.otherDeductions[0],
    otherDeduction2: ctx.otherDeductions[1],
    otherDeduction3: ctx.otherDeductions[2],

    // 備考（1 列）
    notes: "",
  };
}

// ============================================================
// 集計（spec §3.1 メタ情報、bud_mfc_csv_exports に保存）
// ============================================================

export interface MfcCsvAggregation {
  totalEmployees: number;
  totalTaxablePayment: number;
  totalNonTaxablePayment: number;
  totalDeduction: number;
}

/**
 * 全 row を集計し、bud_mfc_csv_exports のメタフィールド向け値を出力。
 */
export function aggregateMfcCsvRows(rows: MfcCsvRow[]): MfcCsvAggregation {
  let totalTaxable = 0;
  let totalNonTaxable = 0;
  let totalDeduction = 0;

  for (const r of rows) {
    // 課税支給 = 各形態の基本給 + 残業 + 深夜 + 課税通勤手当 + インセン
    const taxable =
      r.monthlyBasicPay +
      r.monthlyOvertimePay +
      r.monthlyLateNightPay +
      r.monthlyCommutingTaxable +
      r.hourlyBasicPay +
      r.hourlyApIncentive +
      r.hourlyOvertimePay +
      r.hourlyLateNightPay +
      r.hourlyHolidayPay +
      r.hourlyPresidentIncentive +
      r.hourlyCaseIncentive +
      r.hourlyCommutingTaxable +
      r.dailyBasicPay +
      r.dailyOvertimePay +
      r.dailyLateNightPay +
      r.dailyHolidayPay +
      r.dailyCommutingTaxable;
    totalTaxable += taxable;

    // 非課税通勤手当
    const nonTaxable =
      r.monthlyCommutingNonTaxable +
      r.hourlyCommutingNonTaxable +
      r.dailyCommutingNonTaxable;
    totalNonTaxable += nonTaxable;

    // 控除合計
    const deduction =
      r.healthInsurance +
      r.longTermCareInsurance +
      r.welfarePension +
      r.employmentInsurance +
      r.withholdingTax +
      r.residentTax +
      r.rakutenAdvancePayment +
      r.housingRent +
      r.yearEndAdjustment +
      r.otherDeduction1 +
      r.otherDeduction2 +
      r.otherDeduction3;
    totalDeduction += deduction;
  }

  return {
    totalEmployees: rows.length,
    totalTaxablePayment: totalTaxable,
    totalNonTaxablePayment: totalNonTaxable,
    totalDeduction,
  };
}
