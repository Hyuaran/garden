/**
 * Garden-Bud / Phase D #06 年末調整連携 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-06-nenmatsu-integration.md
 * 対応 migration: supabase/migrations/20260508000004_bud_phase_d06_nenmatsu_integration.sql
 *
 * 設計方針:
 *   - 1 月精算ベース（2026-04-26 改訂、年末手取り安定 + 賞与分離 + 退職者対応シンプル化）
 *   - PII 暗号化は SQL 側 helper（bud_encrypt_my_number / bud_decrypt_my_number）経由
 *   - 純関数は計算のみ、DB I/O は呼び出し元で実施
 */

// ============================================================
// 列挙型
// ============================================================

export const SETTLEMENT_TYPES = ["refund", "additional", "zero"] as const;
export type SettlementType = (typeof SETTLEMENT_TYPES)[number];

export const SETTLEMENT_STATUSES = [
  "calculated",
  "approved",
  "reflected",
  "cancelled",
] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const EXCLUDED_REASONS = [
  "retired_in_year",
  "mid_year_settlement",
  "manual_exclusion",
] as const;
export type ExcludedReason = (typeof EXCLUDED_REASONS)[number];

export const PII_ACCESS_PURPOSES = [
  "year_end_settlement",
  "gensen_choshu_hyo",
  "hotei_chosho",
  "shiharai_chosho",
  "audit_review",
  "admin_correction",
] as const;
export type PiiAccessPurpose = (typeof PII_ACCESS_PURPOSES)[number];

// ============================================================
// 月次源泉徴収累計（Phase C bud_gensen_choshu_bo を経由した集計値）
// ============================================================

/**
 * Phase C `bud_gensen_choshu_bo` から集計した年間累計。
 * 純関数 calculateAnnualWithheld の入力として使用。
 */
export interface MonthlyWithheldRecord {
  fiscalYear: number;
  employeeId: string;
  /** 'monthly' | 'bonus' */
  periodType: "monthly" | "bonus";
  paymentDate: string; // ISO date
  grossPay: number;
  socialInsuranceTotal: number;
  withholdingTax: number;
}

/**
 * 年間累計集計結果。calculateAnnualWithheld の出力。
 */
export interface AnnualWithheldSummary {
  fiscalYear: number;
  employeeId: string;
  totalWithheldToNovember: number; // 11 月までの月次累計
  decemberSalaryWithheld: number; // 12 月給与の予定徴収額
  bonusWithheldTotal: number; // 賞与累計
  totalGrossPay: number;
  totalSocialInsurance: number;
  monthlyRecordCount: number;
  bonusRecordCount: number;
}

// ============================================================
// 精算計算
// ============================================================

/**
 * 精算入力（Phase C で計算された年税額 + D-02/D-03 から集計した既徴収累計）。
 */
export interface SettlementInput {
  fiscalYear: number;
  employeeId: string;
  /** Phase C 計算結果 */
  annualTaxAmount: number;
  /** D-02 月次累計（11 月まで）*/
  totalWithheldToNovember: number;
  /** 12 月給与の予定徴収額 */
  decemberSalaryWithheld: number;
  /** D-03 賞与源泉徴収累計 */
  bonusWithheldTotal: number;
}

/**
 * 精算計算結果（calculateSettlement の出力）。
 *
 * settlement_amount 符号:
 *   - refund (還付): 負値（既徴収 > 年税額、1 月給与に上乗せ）
 *   - additional (追徴): 正値（既徴収 < 年税額、1 月給与から控除）
 *   - zero: 0
 */
export interface SettlementResult {
  fiscalYear: number;
  employeeId: string;
  annualTaxAmount: number;
  totalWithheld: number; // 11 月まで + 12 月予定 + 賞与
  settlementAmount: number; // 正値=追徴 / 負値=還付
  settlementType: SettlementType;
}

// ============================================================
// 精算反映（1 月給与計算時）
// ============================================================

/**
 * 1 月給与計算時の精算反映入力。
 */
export interface ApplySettlementInput {
  /** 1 月給与の通常計算結果 */
  januaryGrossPay: number;
  januaryNormalWithholding: number;
  januaryTotalDeductions: number;
  /** 承認済 settlement */
  settlementAmount: number;
  settlementType: SettlementType;
}

/**
 * 精算反映後の 1 月給与（applySettlementToSalary の出力）。
 */
export interface ApplySettlementResult {
  /** 月次源泉は変えない（spec §10 判 7） */
  januaryNormalWithholding: number;
  /** 精算分（refund: 負、additional: 正、zero: 0） */
  settlementAdjustment: number;
  /** 月次源泉 + 精算 */
  finalWithholding: number;
  /** 控除合計（finalWithholding 反映済） */
  finalTotalDeductions: number;
  /** 手取り（gross - finalTotalDeductions） */
  finalNetPay: number;
}

// ============================================================
// 警告（還付過大 / 追徴過大）
// ============================================================

export const SETTLEMENT_WARNING_CODES = [
  "REFUND_EXCESS_GROSS_20PCT", // 1 月精算還付が gross の 20% 超
  "REFUND_EXCESS_GROSS_30PCT", // 還付が gross の 30% 超（より重い警告）
  "ADDITIONAL_EXCESS_NET_PAY", // 追徴で net_pay マイナス
  "ADDITIONAL_LARGE_30PCT", // 追徴が gross の 30% 超
  "INSTALLMENT_RECOMMENDED", // 12 ヶ月分割推奨
] as const;
export type SettlementWarningCode = (typeof SETTLEMENT_WARNING_CODES)[number];

export interface SettlementWarning {
  code: SettlementWarningCode;
  message: string;
  severity: "info" | "warning" | "error";
}

// ============================================================
// 分割提案（追徴が大きい場合、最長 12 ヶ月）
// ============================================================

export interface InstallmentPlanInput {
  totalAmount: number; // 追徴総額（正値）
  startMonth: number; // 1〜12（通常は 1 月）
  fiscalYear: number;
  /** 1 ヶ月あたり最大徴収額（gross の N% 等の上限） */
  monthlyMaxAmount?: number;
}

export interface InstallmentPlanItem {
  monthNumber: number; // 1, 2, 3 ...
  fiscalYearOfPayment: number;
  amount: number;
}

export interface InstallmentPlanResult {
  totalAmount: number;
  installments: InstallmentPlanItem[];
  totalMonths: number;
  /** 12 ヶ月超なら true（spec §11.5 / 判 2 上限） */
  exceedsMaxMonths: boolean;
}

// ============================================================
// DB レコード型
// ============================================================

export interface BudYearEndSettlement {
  id: string;
  fiscalYear: number;
  employeeId: string;
  nenmatsuChouseiId: string | null;
  totalWithheldToNovember: number;
  decemberSalaryWithheld: number;
  bonusWithheldTotal: number;
  annualTaxAmount: number;
  settlementAmount: number;
  settlementType: SettlementType;
  settlementPeriodId: string;
  excludedReason: ExcludedReason | null;
  status: SettlementStatus;
  calculatedAt: string;
  calculatedBy: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  reflectedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  notes: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface RootEmployeesPii {
  employeeId: string;
  myNumberEncrypted: Uint8Array | null;
  encryptionKeyId: string | null;
  dependentsPiiEncrypted: unknown;
  encryptedAt: string | null;
  encryptedBy: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  retentionUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudPiiAccessLog {
  id: string;
  accessedBy: string;
  targetEmployeeId: string;
  purpose: PiiAccessPurpose;
  context: unknown;
  accessedAt: string;
  clientIp: string | null;
  userAgent: string | null;
}
