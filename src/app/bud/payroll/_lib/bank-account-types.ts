/**
 * Garden-Bud / Phase D #09 口座一覧 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-26-bud-phase-d-09-bank-accounts.md
 * 対応 migration: supabase/migrations/20260507000002_bud_phase_d09_bank_accounts.sql
 *
 * 役割:
 *   - DB スキーマと TS 型の 1:1 対応
 *   - 給与振込口座（全従業員）/ 外部支払先（月変動）/ payroll role 管理 の 3 領域
 */

// ============================================================
// Payroll Role（spec §4 + 4 次 follow-up Cat 4 #26 反映）
// ============================================================

export const PAYROLL_ROLES = [
  "payroll_calculator", // 計算者（上田）
  "payroll_approver", // 承認者（宮永・小泉）V6 自起票禁止
  "payroll_disburser", // 出力者（上田）MFC CSV ダウンロード等
  "payroll_auditor", // 監査（東海林）
  "payroll_visual_checker", // 目視ダブルチェック（上田、4 次 follow-up）
] as const;

export type PayrollRole = (typeof PAYROLL_ROLES)[number];

export interface RootEmployeePayrollRole {
  id: string;
  employeeId: string;
  role: PayrollRole;
  isActive: boolean;
  grantedAt: string;
  grantedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  notes: string | null;
}

// ============================================================
// 口座種別
// ============================================================

export const ACCOUNT_TYPES = ["普通", "当座", "貯蓄"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// ============================================================
// bud_employee_bank_accounts（給与振込口座、employee_id NOT NULL）
// ============================================================

export interface BudEmployeeBankAccount {
  id: string;
  employeeId: string;

  // 口座情報
  bankCode: string; // 4 桁数字
  bankName: string;
  branchCode: string; // 3 桁数字
  branchName: string;
  accountType: AccountType;
  accountNumber: string; // 数字のみ、1-8 桁
  accountHolderKana: string; // 半角カナ（FB 互換）

  // 状態
  isActive: boolean;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null; // YYYY-MM-DD, null = 継続中

  // メタ
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

// ============================================================
// bud_payment_recipients（外部支払先、employee_id NULL 可）
// ============================================================

export const PAYMENT_RECIPIENT_TYPES = [
  "external_company", // 外部企業（取引先）、employee_id NULL
  "individual_special", // 個人外部（フリーランス等）、employee_id NULL
  "employee_special", // 特殊扱い 10 名、employee_id NOT NULL
] as const;

export type PaymentRecipientType = (typeof PAYMENT_RECIPIENT_TYPES)[number];

export interface BudPaymentRecipient {
  id: string;
  employeeId: string | null; // recipient_type で整合性担保
  recipientType: PaymentRecipientType;

  // 識別
  recipientName: string;
  recipientNameKana: string | null;

  // 口座情報
  bankCode: string;
  bankName: string;
  branchCode: string;
  branchName: string;
  accountType: AccountType;
  accountNumber: string;
  accountHolderKana: string;

  // 月単位レコード対応
  appliesMonth: string | null; // YYYY-MM-01, null = 通年
  amount: number | null; // 円
  paymentPurpose: string | null;

  // 状態
  isActive: boolean;
  notes: string | null;

  // メタ
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

// ============================================================
// view_bud_active_employee_accounts（D-07 振込連携が参照）
// ============================================================

export interface ActiveEmployeeAccountView {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  bankAccountId: string;
  bankCode: string;
  bankName: string;
  branchCode: string;
  branchName: string;
  accountType: AccountType;
  accountNumber: string;
  accountHolderKana: string;
}
