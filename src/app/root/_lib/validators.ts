/**
 * Garden Root — マスタ入力バリデーション
 *
 * 各 page.tsx の保存時に呼び出し、エラーメッセージマップを返す。
 * エラーが1件以上あれば、UI 側で赤枠・ヘルプ表示する。
 */

import type {
  Company,
  BankAccount,
  Vendor,
  Employee,
  SalarySystem,
  Insurance,
  Attendance,
} from "../_constants/types";

export type FieldErrors = Partial<Record<string, string>>;

// ------------------------------------------------------------
// プリミティブ
// ------------------------------------------------------------

const RE_KATAKANA = /^[\u30A0-\u30FF\u30FC\s　]+$/; // 全角カタカナ + 長音符 + 半/全角スペース
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_PHONE = /^[0-9+\-()\s]+$/;
const RE_YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_FISCAL_YEAR = /^\d{4}$/;

export function isDigits(v: string, n: number): boolean {
  return new RegExp(`^\\d{${n}}$`).test(v);
}

export function isKatakana(v: string): boolean {
  return v.length === 0 || RE_KATAKANA.test(v);
}

export function isEmail(v: string): boolean {
  return RE_EMAIL.test(v);
}

export function isPhone(v: string | null | undefined): boolean {
  return !v || RE_PHONE.test(v);
}

export function isYearMonth(v: string): boolean {
  return RE_YEAR_MONTH.test(v);
}

export function isFiscalYear(v: string): boolean {
  return RE_FISCAL_YEAR.test(v);
}

export function isInRange(v: number, min: number, max: number): boolean {
  return Number.isFinite(v) && v >= min && v <= max;
}

export function isNonNegative(v: number): boolean {
  return Number.isFinite(v) && v >= 0;
}

// ------------------------------------------------------------
// 1. 法人マスタ
// ------------------------------------------------------------
export function validateCompany(c: Company): FieldErrors {
  const e: FieldErrors = {};
  if (!/^COMP-\d{3,}$/.test(c.company_id)) e.company_id = "COMP-XXX 形式（例: COMP-001）";
  if (!c.company_name.trim()) e.company_name = "必須";
  if (!c.company_name_kana.trim()) e.company_name_kana = "必須";
  else if (!isKatakana(c.company_name_kana)) e.company_name_kana = "全角カタカナのみ";
  if (c.corporate_number && !isDigits(c.corporate_number, 13)) {
    e.corporate_number = "半角数字13桁";
  }
  if (!c.representative.trim()) e.representative = "必須";
  if (!c.address.trim()) e.address = "必須";
  if (c.phone && !isPhone(c.phone)) e.phone = "数字 / ハイフン / 括弧のみ";
  if (!c.default_bank) e.default_bank = "必須";
  return e;
}

// ------------------------------------------------------------
// 2. 銀行口座マスタ
// ------------------------------------------------------------
export function validateBankAccount(a: BankAccount): FieldErrors {
  const e: FieldErrors = {};
  if (!/^ACC-\d{3,}$/.test(a.account_id)) e.account_id = "ACC-XXX 形式";
  if (!a.company_id) e.company_id = "必須";
  if (!a.bank_name.trim()) e.bank_name = "必須";
  if (!isDigits(a.bank_code, 4)) e.bank_code = "半角数字4桁";
  if (!a.branch_name.trim()) e.branch_name = "必須";
  if (!isDigits(a.branch_code, 3)) e.branch_code = "半角数字3桁";
  if (!a.account_type) e.account_type = "必須";
  if (!isDigits(a.account_number, 7)) e.account_number = "半角数字7桁";
  if (!a.account_holder.trim()) e.account_holder = "必須";
  return e;
}

// ------------------------------------------------------------
// 3. 取引先マスタ
// ------------------------------------------------------------
export function validateVendor(v: Vendor): FieldErrors {
  const e: FieldErrors = {};
  if (!/^VND-\d{3,}$/.test(v.vendor_id)) e.vendor_id = "VND-XXX 形式";
  if (!v.vendor_name.trim()) e.vendor_name = "必須";
  if (!v.vendor_name_kana.trim()) e.vendor_name_kana = "必須";
  else if (!isKatakana(v.vendor_name_kana)) e.vendor_name_kana = "全角カタカナのみ";
  if (!v.bank_name.trim()) e.bank_name = "必須";
  if (!isDigits(v.bank_code, 4)) e.bank_code = "半角数字4桁";
  if (!v.branch_name.trim()) e.branch_name = "必須";
  if (!isDigits(v.branch_code, 3)) e.branch_code = "半角数字3桁";
  if (!v.account_type) e.account_type = "必須";
  if (!isDigits(v.account_number, 7)) e.account_number = "半角数字7桁";
  if (!v.account_holder_kana.trim()) e.account_holder_kana = "必須";
  else if (!isKatakana(v.account_holder_kana)) e.account_holder_kana = "全角カタカナのみ（銀行CSV形式）";
  if (!v.fee_bearer) e.fee_bearer = "必須";
  return e;
}

// ------------------------------------------------------------
// 4. 給与体系マスタ
// ------------------------------------------------------------
export function validateSalarySystem(s: SalarySystem): FieldErrors {
  const e: FieldErrors = {};
  if (!/^SAL-SYS-\d{3,}$/.test(s.salary_system_id)) e.salary_system_id = "SAL-SYS-XXX 形式";
  if (!s.system_name.trim()) e.system_name = "必須";
  if (!s.employment_type) e.employment_type = "必須";
  if (!s.base_salary_type) e.base_salary_type = "必須";
  if (!isInRange(s.working_hours_day, 0, 24)) e.working_hours_day = "0〜24 の範囲";
  if (!isInRange(s.working_days_month, 0, 31)) e.working_days_month = "0〜31 の範囲";
  if (!isInRange(s.overtime_rate, 1, 3)) e.overtime_rate = "1〜3 の範囲（例: 1.25）";
  if (!isInRange(s.night_overtime_rate, 1, 3)) e.night_overtime_rate = "1〜3 の範囲（例: 1.35）";
  if (!isInRange(s.holiday_overtime_rate, 1, 3)) e.holiday_overtime_rate = "1〜3 の範囲（例: 1.35）";
  return e;
}

// ------------------------------------------------------------
// 5. 従業員マスタ
// ------------------------------------------------------------
export function validateEmployee(em: Employee): FieldErrors {
  const e: FieldErrors = {};
  if (!/^EMP-\d{4,}$/.test(em.employee_id)) e.employee_id = "EMP-XXXX 形式";
  if (!em.employee_number.trim()) e.employee_number = "必須";
  if (!em.name.trim()) e.name = "必須";
  if (!em.name_kana.trim()) e.name_kana = "必須";
  else if (!isKatakana(em.name_kana)) e.name_kana = "全角カタカナのみ";
  if (!em.company_id) e.company_id = "必須";
  if (!em.employment_type) e.employment_type = "必須";
  if (!em.salary_system_id) e.salary_system_id = "必須";
  if (!em.hire_date) e.hire_date = "必須";
  if (em.termination_date && em.hire_date && em.termination_date < em.hire_date) {
    e.termination_date = "入社日より前にはできません";
  }
  if (!em.email.trim()) e.email = "必須";
  else if (!isEmail(em.email)) e.email = "メール形式（例: name@example.com）";
  if (!em.bank_name.trim()) e.bank_name = "必須";
  if (!isDigits(em.bank_code, 4)) e.bank_code = "半角数字4桁";
  if (!em.branch_name.trim()) e.branch_name = "必須";
  if (!isDigits(em.branch_code, 3)) e.branch_code = "半角数字3桁";
  if (!isDigits(em.account_number, 7)) e.account_number = "半角数字7桁";
  if (!em.account_holder.trim()) e.account_holder = "必須";
  if (!em.account_holder_kana.trim()) e.account_holder_kana = "必須";
  else if (!isKatakana(em.account_holder_kana)) e.account_holder_kana = "全角カタカナのみ";
  if (!em.insurance_type) e.insurance_type = "必須";
  return e;
}

// ------------------------------------------------------------
// 6. 社会保険マスタ
// ------------------------------------------------------------
export function validateInsurance(i: Insurance): FieldErrors {
  const e: FieldErrors = {};
  if (!/^INS-\d{4,}$/.test(i.insurance_id)) e.insurance_id = "INS-XXXX 形式";
  if (!isFiscalYear(i.fiscal_year)) e.fiscal_year = "4桁の西暦";
  if (!i.effective_from) e.effective_from = "必須";
  if (i.effective_to && i.effective_from && i.effective_to < i.effective_from) {
    e.effective_to = "開始日より前にはできません";
  }
  if (!isInRange(i.health_insurance_rate, 0, 100)) e.health_insurance_rate = "0〜100 の範囲（%）";
  if (!isInRange(i.nursing_insurance_rate, 0, 100)) e.nursing_insurance_rate = "0〜100 の範囲（%）";
  if (!isInRange(i.pension_rate, 0, 100)) e.pension_rate = "0〜100 の範囲（%）";
  if (!isInRange(i.employment_insurance_rate, 0, 100)) e.employment_insurance_rate = "0〜100 の範囲（%）";
  if (!isInRange(i.child_support_rate, 0, 100)) e.child_support_rate = "0〜100 の範囲（%）";
  return e;
}

// ------------------------------------------------------------
// 7. 勤怠データ
// ------------------------------------------------------------
export function validateAttendance(a: Attendance): FieldErrors {
  const e: FieldErrors = {};
  if (!a.attendance_id.trim()) e.attendance_id = "必須";
  if (!a.employee_id) e.employee_id = "必須";
  if (!isYearMonth(a.target_month)) e.target_month = "YYYY-MM 形式（例: 2026-04）";
  if (!isInRange(a.working_days, 0, 31)) e.working_days = "0〜31 の範囲";
  if (!isInRange(a.absence_days, 0, 31)) e.absence_days = "0〜31 の範囲";
  if (!isInRange(a.paid_leave_days, 0, 31)) e.paid_leave_days = "0〜31 の範囲";
  const hourFields: (keyof Attendance)[] = [
    "scheduled_hours", "actual_hours", "overtime_hours", "legal_overtime_hours",
    "night_hours", "holiday_hours", "late_hours", "early_leave_hours",
  ];
  for (const f of hourFields) {
    const v = a[f] as number;
    if (!isInRange(v, 0, 744)) e[f as string] = "0〜744 時間の範囲";
  }
  if (a.training_hours !== null && !isInRange(a.training_hours, 0, 744)) {
    e.training_hours = "0〜744 時間の範囲";
  }
  if (a.office_hours !== null && !isInRange(a.office_hours, 0, 744)) {
    e.office_hours = "0〜744 時間の範囲";
  }
  if (!a.import_status) e.import_status = "必須";
  return e;
}

// ------------------------------------------------------------
// ユーティリティ
// ------------------------------------------------------------
export function hasErrors(errs: FieldErrors): boolean {
  return Object.keys(errs).length > 0;
}

export const VALIDATION_ERROR_BANNER = "入力エラーがあります。赤枠の項目を確認してください。";
