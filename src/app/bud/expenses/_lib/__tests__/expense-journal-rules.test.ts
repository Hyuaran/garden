import { describe, expect, it } from "vitest";

import { calculateIncludedTax, classifyExpenseJournal, toYayoiRows } from "../expense-journal-rules";

const base = {
  id: "req-1",
  receiptDate: "2026-06-10",
  categoryName: "会議費",
  storeName: "会議室",
  amount: 1000,
  qualifiedClass: "有",
  applicantName: "東海林 美琴",
};

describe("expense journal rules", () => {
  it("applies the 5,000 yen rule from meeting expense to entertainment", () => {
    const result = classifyExpenseJournal({ ...base, categoryName: "会議費", amount: 5001 });
    expect(result.ok).toBe(true);
    expect(result.debitAccount).toBe("接待交際費");
    expect(result.note).toContain("5,000円超");
  });

  it("applies the 5,000 yen rule from entertainment to meeting expense", () => {
    const result = classifyExpenseJournal({ ...base, categoryName: "接待交際費", amount: 5000 });
    expect(result.ok).toBe(true);
    expect(result.debitAccount).toBe("会議費");
    expect(result.note).toContain("5,000円以下");
  });

  it("keeps entertainment expense for golf stores even when amount is 5,000 yen or less", () => {
    const result = classifyExpenseJournal({
      ...base,
      categoryName: "接待交際費",
      storeName: "GOLF BAR",
      amount: 4500,
    });
    expect(result.ok).toBe(true);
    expect(result.debitAccount).toBe("接待交際費");
    expect(result.note).toContain("ゴルフ関連");
  });

  it("replaces taxable class for unqualified invoices", () => {
    const result = classifyExpenseJournal({ ...base, categoryName: "旅費交通費", qualifiedClass: "無" });
    expect(result.ok).toBe(true);
    expect(result.debitTaxClass).toBe("課対仕入80%控 10%");
  });

  it("uses SONOTA_MAP for other category by store name", () => {
    const result = classifyExpenseJournal({
      ...base,
      categoryName: "その他",
      storeName: "KDDI 利用料",
      amount: 8800,
    });
    expect(result.ok).toBe(true);
    expect(result.debitAccount).toBe("通信費");
    expect(result.debitTaxClass).toBe("課税仕入 10%");
    expect(result.note).toContain("KDDI");
  });

  it("keeps target-out tax class and tax amount zero", () => {
    const result = classifyExpenseJournal({
      ...base,
      categoryName: "社用車罰金",
      storeName: "反則金",
      amount: 12000,
      qualifiedClass: "無",
    });
    expect(result.ok).toBe(true);
    expect(result.debitTaxClass).toBe("対象外");
    expect(result.debitTaxAmount).toBe(0);
  });

  it("calculates included tax for 10 percent and 8 percent tax classes", () => {
    expect(calculateIncludedTax(1100, "課税仕入 10%")).toBe(100);
    expect(calculateIncludedTax(1080, "課税仕入 8%")).toBe(80);
    expect(calculateIncludedTax(1080, "対象外")).toBe(0);
  });

  it("excludes zero amount and unresolved rows from Yayoi rows", () => {
    const zero = classifyExpenseJournal({ ...base, amount: 0 });
    const unknown = classifyExpenseJournal({ ...base, categoryName: "その他", storeName: "不明店" });
    const ok = classifyExpenseJournal({ ...base, amount: 1100 });
    const rows = toYayoiRows([zero, unknown, ok]);
    expect(zero.ok).toBe(false);
    expect(unknown.ok).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0].denpyo_no).toBe(1);
    expect(rows[0].credit_account).toBe("現金");
  });
});
