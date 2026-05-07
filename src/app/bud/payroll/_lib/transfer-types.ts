/**
 * Garden-Bud / Phase D #07 銀行振込 TypeScript 型定義
 *
 * 対応 spec: docs/specs/2026-04-25-bud-phase-d-07-bank-transfer.md
 * 対応 migration: supabase/migrations/20260507000006_bud_phase_d07_bank_transfer.sql
 *
 * Cat 4 #27 反映: MFC CSV 出力 = 振込ファイル生成と同時（exportPayrollBatchHybrid）。
 */

// ============================================================
// 列挙型
// ============================================================

export const TRANSFER_TYPES = ["salary", "bonus"] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

export const TRANSFER_BATCH_STATUSES = [
  "draft",
  "approved",
  "fb_generated",
  "uploaded_to_bank",
  "completed",
  "failed",
] as const;
export type TransferBatchStatus = (typeof TRANSFER_BATCH_STATUSES)[number];

export const TRANSFER_ITEM_STATUSES = [
  "pending",
  "submitted",
  "completed",
  "failed",
  "rejected",
] as const;
export type TransferItemStatus = (typeof TRANSFER_ITEM_STATUSES)[number];

export const ACCOUNTING_CATEGORIES = [
  "役員報酬",
  "給与",
  "賞与",
  "交通費",
  "会社負担社保等",
  "外注費",
  "販売促進費",
  "固定費等",
] as const;
export type AccountingCategory = (typeof ACCOUNTING_CATEGORIES)[number];

// ============================================================
// 振込バッチ・明細
// ============================================================

export interface BudPayrollTransferBatch {
  id: string;
  payrollPeriodId: string;
  companyId: string;
  sourceBankAccountId: string;
  transferType: TransferType;
  scheduledPaymentDate: string;
  totalEmployees: number;
  totalAmount: number;
  fbDataPath: string | null;
  status: TransferBatchStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  fbGeneratedAt: string | null;
  bankUploadedAt: string | null;
  completedAt: string | null;
  failedReason: string | null;
  notes: string | null;
}

export interface BudPayrollTransferItem {
  id: string;
  batchId: string;
  salaryRecordId: string | null;
  bonusRecordId: string | null;
  employeeId: string;
  recipientBankCode: string;
  recipientBranchCode: string;
  recipientAccountType: "普通" | "当座" | "貯蓄";
  recipientAccountNumber: string;
  recipientAccountHolder: string; // 半角カナ
  transferAmount: number;
  budFurikomiId: string | null;
  fbRecordNo: number | null;
  itemStatus: TransferItemStatus;
  failedReason: string | null;
}

// ============================================================
// 8 大区分階層レポート構造
// ============================================================

export interface AccountingCategoryItem {
  name: string;
  amount: number;
}

export interface AccountingCategoryEntry {
  items: AccountingCategoryItem[];
  subtotal: number;
  /** true = 当該月該当データなし、CSV 出力に枠だけ保持 */
  isFutureUse: boolean;
}

export type CategoryHierarchy = Record<AccountingCategory, AccountingCategoryEntry>;

export interface BudPayrollAccountingReport {
  id: string;
  batchId: string;
  reportCsvStoragePath: string;
  reportCsvFilename: string;
  reportCsvSizeBytes: number;
  reportCsvChecksum: string;
  totalEmployees: number;
  totalAmount: number;
  categoryHierarchy: CategoryHierarchy;
  generatedAt: string;
  generatedBy: string;
  downloadedAt: string | null;
  downloadedBy: string | null;
  importedToMfAt: string | null;
  importedToMfBy: string | null;
  sharedWithGodoAt: string | null;
  sharedWithGodoBy: string | null;
  notes: string | null;
}

// ============================================================
// FB データ生成入力
// ============================================================

export interface FbHeaderInput {
  /** 依頼人コード（10 文字、銀行発行）*/
  requesterCode: string;
  /** 依頼人名（半角カナ、40 文字以内）*/
  requesterName: string;
  /** 振込指定日（MMDD）*/
  paymentDate: string; // 'MMDD'
  /** 仕向銀行番号（4 桁）*/
  sourceBankCode: string;
  /** 仕向銀行名（半角カナ、15 文字以内）*/
  sourceBankName: string;
  /** 仕向支店番号（3 桁）*/
  sourceBranchCode: string;
  /** 仕向支店名（半角カナ、15 文字以内）*/
  sourceBranchName: string;
  /** 預金種目（1=普通, 2=当座）*/
  sourceAccountType: "1" | "2";
  /** 口座番号（7 桁、ゼロパディング）*/
  sourceAccountNumber: string;
}

export interface FbDataRecordInput {
  /** 被仕向銀行番号（4 桁）*/
  recipientBankCode: string;
  /** 被仕向銀行名（半角カナ、15 文字以内）*/
  recipientBankName: string;
  /** 被仕向支店番号（3 桁）*/
  recipientBranchCode: string;
  /** 被仕向支店名（半角カナ、15 文字以内）*/
  recipientBranchName: string;
  /** 預金種目 */
  recipientAccountType: "1" | "2";
  /** 口座番号（7 桁ゼロパディング）*/
  recipientAccountNumber: string;
  /** 受取人名（半角カナ、30 文字以内）*/
  recipientName: string;
  /** 振込金額（円）*/
  amount: number;
}

// ============================================================
// 8 大区分の固定順序
// ============================================================

export const ACCOUNTING_CATEGORIES_ORDER: readonly AccountingCategory[] = [
  "役員報酬",
  "給与",
  "賞与",
  "交通費",
  "会社負担社保等",
  "外注費",
  "販売促進費",
  "固定費等",
];
