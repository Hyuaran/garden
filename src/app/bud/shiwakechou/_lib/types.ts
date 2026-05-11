/**
 * Garden-Bud / 07_Shiwakechou 仕訳帳 TypeScript 型定義
 *
 * 対応 dispatch: main- No. 277（5/12 後段 alpha = 仕訳閲覧 + 弥生 export ボタン）
 * 対応 migration: supabase/migrations/20260511000011_bud_journal_entries.sql
 */

export const JOURNAL_SOURCES = [
  "csv_auto",
  "manual_input",
  "expense_claim",
  "payroll",
  "other",
] as const;
export type JournalSource = (typeof JOURNAL_SOURCES)[number];

export const JOURNAL_STATUSES = [
  "pending",
  "confirmed",
  "exported",
  "cancelled",
] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

export const ACCOUNT_CATEGORIES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "other",
] as const;
export type AccountCategory = (typeof ACCOUNT_CATEGORIES)[number];

export const EXPORT_FORMATS = ["yayoi_csv", "yayoi_csv_v2", "freee_csv"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

// ============================================================
// 表示ラベル
// ============================================================

export const STATUS_LABELS: Record<JournalStatus, string> = {
  pending: "確認待ち",
  confirmed: "確認済",
  exported: "弥生連携済",
  cancelled: "取消",
};

export const STATUS_BADGE_COLORS: Record<JournalStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  exported: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export const SOURCE_LABELS: Record<JournalSource, string> = {
  csv_auto: "CSV 自動",
  manual_input: "手入力",
  expense_claim: "経費精算",
  payroll: "給与計算",
  other: "その他",
};

// ============================================================
// DB レコード型
// ============================================================

export interface BudJournalAccount {
  id: string;
  accountCode: string;
  accountName: string;
  accountCategory: AccountCategory;
  displayOrder: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BudJournalEntry {
  id: string;
  entryDate: string;
  debitAccountCode: string;
  creditAccountCode: string;
  amount: number;
  description: string | null;
  memo: string | null;
  source: JournalSource;
  sourceBankTransactionId: string | null;
  status: JournalStatus;
  confirmedAt: string | null;
  confirmedBy: string | null;
  exportedAt: string | null;
  exportLogId: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelledReason: string | null;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BudJournalExportLog {
  id: string;
  dateFrom: string;
  dateTo: string;
  entryCount: number;
  totalDebit: number;
  totalCredit: number;
  format: ExportFormat;
  fileName: string;
  fileSha256: string | null;
  fileSizeBytes: number | null;
  storagePath: string | null;
  exportedAt: string;
  exportedBy: string | null;
  notes: string | null;
}

// ============================================================
// UI 表示用 集計型
// ============================================================

export interface JournalSummary {
  entries: BudJournalEntry[];
  accounts: BudJournalAccount[];
  totalEntries: number;
  totalDebit: number;
  totalCredit: number;
  byStatus: Record<JournalStatus, number>;
  dateFrom: string;
  dateTo: string;
}
