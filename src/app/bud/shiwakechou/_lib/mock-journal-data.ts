/**
 * Garden-Bud / 07_Shiwakechou: alpha 版 mock 仕訳データ
 *
 * 対応 dispatch: main- No. 277（5/12 後段 alpha = 仕訳一覧 + 弥生 export ボタン）
 *
 * 出典: 既存 mock HTML（015_Gardenシリーズ/000_GardenUI_bud/07_Shiwakechou/index.html）
 * を元に、典型的な銀行取引仕訳パターン 10 件を埋め込み。
 * 5/11 11:48 時点の Bank mock data（# 276）と整合性を保持。
 */

import type {
  BudJournalAccount,
  BudJournalEntry,
  JournalSummary,
} from "./types";

const NOW = "2026-05-11T16:00:00+09:00";

// ============================================================
// 弥生体系準拠 勘定科目マスタ（最小サンプル）
// ============================================================

export const mockJournalAccounts: BudJournalAccount[] = [
  {
    id: "acc-101",
    accountCode: "101",
    accountName: "現金",
    accountCategory: "asset",
    displayOrder: 1,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-111",
    accountCode: "111",
    accountName: "普通預金",
    accountCategory: "asset",
    displayOrder: 2,
    isActive: true,
    notes: "みずほ / 楽天 / PayPay / 京都 共通",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-135",
    accountCode: "135",
    accountName: "売掛金",
    accountCategory: "asset",
    displayOrder: 3,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-211",
    accountCode: "211",
    accountName: "買掛金",
    accountCategory: "liability",
    displayOrder: 4,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-401",
    accountCode: "401",
    accountName: "売上高",
    accountCategory: "revenue",
    displayOrder: 5,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-510",
    accountCode: "510",
    accountName: "仕入高",
    accountCategory: "expense",
    displayOrder: 6,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-704",
    accountCode: "704",
    accountName: "通信費",
    accountCategory: "expense",
    displayOrder: 7,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-721",
    accountCode: "721",
    accountName: "支払手数料",
    accountCategory: "expense",
    displayOrder: 8,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-757",
    accountCode: "757",
    accountName: "給料手当",
    accountCategory: "expense",
    displayOrder: 9,
    isActive: true,
    notes: "Bud Phase D 給与計算連動",
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
  {
    id: "acc-816",
    accountCode: "816",
    accountName: "受取利息",
    accountCategory: "revenue",
    displayOrder: 10,
    isActive: true,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  },
];

// ============================================================
// 仕訳サンプル 10 件
// ============================================================

function buildEntry(
  id: string,
  overrides: Partial<BudJournalEntry>,
): BudJournalEntry {
  return {
    id,
    entryDate: "2026-05-10",
    debitAccountCode: "111",
    creditAccountCode: "401",
    amount: 0,
    description: null,
    memo: null,
    source: "csv_auto",
    sourceBankTransactionId: null,
    status: "pending",
    confirmedAt: null,
    confirmedBy: null,
    exportedAt: null,
    exportLogId: null,
    cancelledAt: null,
    cancelledBy: null,
    cancelledReason: null,
    notes: null,
    createdAt: NOW,
    createdBy: null,
    updatedAt: NOW,
    deletedAt: null,
    ...overrides,
  };
}

export const mockJournalEntries: BudJournalEntry[] = [
  // pending: 銀行取引から自動仕訳化、確認待ち
  buildEntry("ent-001", {
    entryDate: "2026-05-10",
    debitAccountCode: "111",
    creditAccountCode: "401",
    amount: 1_650_000,
    description: "ヒュアラン 売上入金（楽天銀行）",
    source: "csv_auto",
    status: "pending",
  }),
  buildEntry("ent-002", {
    entryDate: "2026-05-09",
    debitAccountCode: "510",
    creditAccountCode: "111",
    amount: 880_000,
    description: "ARATA 仕入支払（みずほ銀行）",
    source: "csv_auto",
    status: "pending",
  }),
  buildEntry("ent-003", {
    entryDate: "2026-05-08",
    debitAccountCode: "704",
    creditAccountCode: "111",
    amount: 33_000,
    description: "通信費 NTT（楽天銀行）",
    source: "csv_auto",
    status: "pending",
  }),

  // confirmed: 東海林さん確認済、弥生 export 対象
  buildEntry("ent-004", {
    entryDate: "2026-05-07",
    debitAccountCode: "111",
    creditAccountCode: "401",
    amount: 2_200_000,
    description: "センターライズ 売上入金",
    source: "csv_auto",
    status: "confirmed",
    confirmedAt: "2026-05-08T09:00:00+09:00",
  }),
  buildEntry("ent-005", {
    entryDate: "2026-05-06",
    debitAccountCode: "757",
    creditAccountCode: "111",
    amount: 4_500_000,
    description: "5 月給与支給（ヒュアラン 6 名分）",
    source: "payroll",
    status: "confirmed",
    confirmedAt: "2026-05-07T15:00:00+09:00",
  }),
  buildEntry("ent-006", {
    entryDate: "2026-05-05",
    debitAccountCode: "721",
    creditAccountCode: "111",
    amount: 880,
    description: "振込手数料",
    source: "csv_auto",
    status: "confirmed",
    confirmedAt: "2026-05-06T10:30:00+09:00",
  }),

  // exported: 弥生連携完了
  buildEntry("ent-007", {
    entryDate: "2026-04-30",
    debitAccountCode: "111",
    creditAccountCode: "816",
    amount: 1_234,
    description: "受取利息（楽天銀行 4 月）",
    source: "csv_auto",
    status: "exported",
    confirmedAt: "2026-05-01T09:00:00+09:00",
    exportedAt: "2026-05-02T14:00:00+09:00",
  }),
  buildEntry("ent-008", {
    entryDate: "2026-04-28",
    debitAccountCode: "135",
    creditAccountCode: "401",
    amount: 1_320_000,
    description: "リンクサポート 売上計上（請求書発行）",
    source: "manual_input",
    status: "exported",
    confirmedAt: "2026-04-29T10:00:00+09:00",
    exportedAt: "2026-05-02T14:00:00+09:00",
  }),
  buildEntry("ent-009", {
    entryDate: "2026-04-25",
    debitAccountCode: "211",
    creditAccountCode: "111",
    amount: 660_000,
    description: "たいよう 買掛金支払",
    source: "expense_claim",
    status: "exported",
    confirmedAt: "2026-04-26T11:00:00+09:00",
    exportedAt: "2026-05-02T14:00:00+09:00",
  }),

  // cancelled: 取消
  buildEntry("ent-010", {
    entryDate: "2026-05-04",
    debitAccountCode: "510",
    creditAccountCode: "111",
    amount: 55_000,
    description: "誤入力（修正のため取消）",
    source: "manual_input",
    status: "cancelled",
    cancelledAt: "2026-05-04T18:00:00+09:00",
    cancelledReason: "取引先誤り、ent-011 で再起票",
  }),
];

// ============================================================
// 集計
// ============================================================

export function getMockJournalSummary(): JournalSummary {
  const entries = mockJournalEntries.filter((e) => e.status !== "cancelled");

  const totalDebit = entries.reduce((acc, e) => acc + e.amount, 0);
  const totalCredit = totalDebit; // 借方 = 貸方 の複式簿記

  const byStatus = mockJournalEntries.reduce(
    (acc, e) => {
      acc[e.status] = (acc[e.status] ?? 0) + 1;
      return acc;
    },
    { pending: 0, confirmed: 0, exported: 0, cancelled: 0 } as Record<
      "pending" | "confirmed" | "exported" | "cancelled",
      number
    >,
  );

  const dates = mockJournalEntries.map((e) => e.entryDate).sort();

  return {
    entries: mockJournalEntries,
    accounts: mockJournalAccounts,
    totalEntries: mockJournalEntries.length,
    totalDebit,
    totalCredit,
    byStatus,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
  };
}
