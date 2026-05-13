/**
 * Garden-Bud / 03_Bank 銀行口座 + 残高 TypeScript 型定義
 *
 * 対応 dispatch: main- No. 276（5/12 デモ前 alpha = 残高表示のみ）
 * 対応 migration:
 *   - supabase/migrations/20260511000010_bud_bank_accounts_balances.sql（初版、旧 bud_bank_*）
 *   - supabase/migrations/20260513000001_rename_bud_bank_to_root_bank.sql（5/13 root_bank_* へ rename、main- No. 339 §D α 採用）
 */

export const CORP_CODES = [
  "hyuaran",
  "centerrise",
  "linksupport",
  "arata",
  "taiyou",
  "ichi",
] as const;
export type CorpCode = (typeof CORP_CODES)[number];

export const BANK_CODES = ["mizuho", "rakuten", "paypay", "kyoto"] as const;
export type BankCode = (typeof BANK_CODES)[number];

export const BALANCE_SOURCES = [
  "csv_auto",
  "manual_input",
  "api_sync",
] as const;
export type BalanceSource = (typeof BALANCE_SOURCES)[number];

export const ACCOUNT_TYPES = ["普通", "当座", "貯蓄"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// ============================================================
// 表示用ラベル（UI 表示の正本）
// ============================================================

export const CORP_LABELS: Record<CorpCode, string> = {
  hyuaran: "ヒュアラン",
  centerrise: "センターライズ",
  linksupport: "リンクサポート",
  arata: "ARATA",
  taiyou: "たいよう",
  ichi: "壱",
};

export const BANK_LABELS: Record<BankCode, string> = {
  mizuho: "みずほ銀行",
  rakuten: "楽天銀行",
  paypay: "PayPay 銀行",
  kyoto: "京都銀行",
};

// ============================================================
// DB レコード型
// ============================================================

export interface BudBankAccount {
  id: string;
  corpCode: CorpCode;
  bankCode: BankCode;
  bankName: string;
  branchName: string | null;
  branchCode: string | null;
  accountType: AccountType;
  accountNumber: string | null;
  isActive: boolean;
  hasCsvExport: boolean;
  needsManualBalance: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface BudBankBalance {
  id: string;
  bankAccountId: string;
  balanceDate: string;
  balanceAmount: number;
  source: BalanceSource;
  inputUserId: string | null;
  sourceCsvPath: string | null;
  notes: string | null;
  createdAt: string;
}

export interface BudBankTransaction {
  id: string;
  bankAccountId: string;
  transactionDate: string;
  amount: number;
  description: string | null;
  balanceAfter: number | null;
  sourceCsvPath: string;
  rawRow: unknown;
  importedAt: string;
}

// ============================================================
// UI 表示用集計型
// ============================================================

/**
 * 1 法人の銀行別残高サマリ。サイドバー / カード表示で使用。
 */
export interface CorpBankSummary {
  corpCode: CorpCode;
  corpLabel: string;
  /** 銀行ごとの最新残高（その法人で利用していない銀行は省略）*/
  banks: Array<{
    bankCode: BankCode;
    bankLabel: string;
    balance: number;
    source: BalanceSource;
    balanceDate: string;
    needsManualBalance: boolean;
  }>;
  /** 法人合計 */
  total: number;
}

/**
 * 全社合計サマリ（最上段の総合計カード用）。
 */
export interface AllCorpsSummary {
  corpSummaries: CorpBankSummary[];
  grandTotal: number;
  /** 最古の残高日付（古ければ警告）*/
  oldestBalanceDate: string;
  /** 最新の残高日付 */
  latestBalanceDate: string;
}
