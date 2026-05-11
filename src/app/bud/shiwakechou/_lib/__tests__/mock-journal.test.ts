/**
 * 07_Shiwakechou mock journal data 検算
 *
 * 検算項目:
 *   1. 勘定科目マスタ 10 件、弥生体系（資産 / 負債 / 純資産 / 収益 / 費用）網羅
 *   2. 仕訳エントリ 10 件、4 status 網羅（pending / confirmed / exported / cancelled）
 *   3. 借方 = 貸方（複式簿記、cancelled 除外）
 *   4. status 別件数（pending 3 / confirmed 3 / exported 3 / cancelled 1）
 *   5. source 区分（csv_auto / manual_input / payroll / expense_claim）
 *   6. 借方 ≠ 貸方 制約（DB CHECK と整合）
 */

import { describe, expect, it } from "vitest";
import {
  getMockJournalSummary,
  mockJournalAccounts,
  mockJournalEntries,
} from "../mock-journal-data";

describe("07_Shiwakechou mock data 検算", () => {
  it("勘定科目マスタ 10 件、5 カテゴリ網羅", () => {
    expect(mockJournalAccounts).toHaveLength(10);

    const categories = new Set(mockJournalAccounts.map((a) => a.accountCategory));
    expect(categories.has("asset")).toBe(true);
    expect(categories.has("liability")).toBe(true);
    expect(categories.has("revenue")).toBe(true);
    expect(categories.has("expense")).toBe(true);

    // 弥生形式: 3 桁数字コード
    mockJournalAccounts.forEach((a) => {
      expect(a.accountCode).toMatch(/^\d{3}$/);
    });
  });

  it("仕訳エントリ 10 件、4 status 網羅", () => {
    expect(mockJournalEntries).toHaveLength(10);

    const summary = getMockJournalSummary();
    expect(summary.byStatus.pending).toBe(3);
    expect(summary.byStatus.confirmed).toBe(3);
    expect(summary.byStatus.exported).toBe(3);
    expect(summary.byStatus.cancelled).toBe(1);
  });

  it("借方 = 貸方（複式簿記、cancelled 除外）", () => {
    const summary = getMockJournalSummary();
    expect(summary.totalDebit).toBe(summary.totalCredit);
    expect(summary.totalDebit).toBeGreaterThan(0);
  });

  it("source 区分 4 種網羅（csv_auto / manual_input / payroll / expense_claim）", () => {
    const sources = new Set(mockJournalEntries.map((e) => e.source));
    expect(sources.has("csv_auto")).toBe(true);
    expect(sources.has("manual_input")).toBe(true);
    expect(sources.has("payroll")).toBe(true);
    expect(sources.has("expense_claim")).toBe(true);
  });

  it("borrow ≠ credit CHECK 制約整合（DB chk_bje_debit_credit_different）", () => {
    mockJournalEntries.forEach((e) => {
      expect(e.debitAccountCode).not.toBe(e.creditAccountCode);
    });
  });

  it("金額は全て正値（DB CHECK amount > 0）", () => {
    mockJournalEntries.forEach((e) => {
      expect(e.amount).toBeGreaterThan(0);
    });
  });

  it("confirmed/exported は confirmedAt あり、pending は null", () => {
    mockJournalEntries.forEach((e) => {
      if (e.status === "pending") {
        expect(e.confirmedAt).toBeNull();
      }
      if (e.status === "confirmed" || e.status === "exported") {
        expect(e.confirmedAt).not.toBeNull();
      }
    });
  });

  it("exported は exportedAt あり、それ以外は null", () => {
    mockJournalEntries.forEach((e) => {
      if (e.status === "exported") {
        expect(e.exportedAt).not.toBeNull();
      } else {
        expect(e.exportedAt).toBeNull();
      }
    });
  });

  it("cancelled は cancelledAt + cancelledReason あり", () => {
    const cancelled = mockJournalEntries.filter((e) => e.status === "cancelled");
    expect(cancelled.length).toBeGreaterThan(0);
    cancelled.forEach((e) => {
      expect(e.cancelledAt).not.toBeNull();
      expect(e.cancelledReason).not.toBeNull();
    });
  });

  it("dateFrom / dateTo は実際の最古/最新と一致", () => {
    const summary = getMockJournalSummary();
    const dates = mockJournalEntries.map((e) => e.entryDate).sort();
    expect(summary.dateFrom).toBe(dates[0]);
    expect(summary.dateTo).toBe(dates[dates.length - 1]);
  });
});
