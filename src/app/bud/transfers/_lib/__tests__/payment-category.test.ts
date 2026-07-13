import { describe, expect, it } from "vitest";

import {
  filterByPaymentCategory,
  formatPaymentCategory,
  formatRegisteredMethod,
  hasAnyPayeasyNumber,
  isValidPayeasyBillerNo,
  normalizePayeasyNumber,
} from "../payment-category";

describe("payment-category helpers", () => {
  it("formats payment category labels", () => {
    expect(formatPaymentCategory("transfer")).toBe("振込");
    expect(formatPaymentCategory("payeasy")).toBe("ペイジー");
    expect(formatPaymentCategory("cash")).toBe("現金");
    expect(formatPaymentCategory("deposit")).toBe("預金");
    expect(formatPaymentCategory("registered")).toBe("決済登録済");
  });

  it("falls back unknown payment category to transfer", () => {
    expect(formatPaymentCategory(null)).toBe("振込");
    expect(formatPaymentCategory("legacy")).toBe("振込");
  });

  it("formats registered methods", () => {
    expect(formatRegisteredMethod("credit_card")).toBe("クレカ");
    expect(formatRegisteredMethod("direct_debit")).toBe("口座振替");
    expect(formatRegisteredMethod("auto_transfer")).toBe("自動振込");
    expect(formatRegisteredMethod(null)).toBe("—");
  });

  it("filters rows by payment category", () => {
    const rows = [
      { id: 1, payment_category: "transfer" },
      { id: 2, payment_category: "payeasy" },
      { id: 3, payment_category: null },
      { id: 4, payment_category: "deposit" },
    ];
    expect(filterByPaymentCategory(rows, "transfer").map((row) => row.id)).toEqual([1, 3]);
    expect(filterByPaymentCategory(rows, "payeasy").map((row) => row.id)).toEqual([2]);
    expect(filterByPaymentCategory(rows, "deposit").map((row) => row.id)).toEqual([4]);
  });

  it("normalizes payeasy numbers", () => {
    expect(normalizePayeasyNumber(" １２３-４５ 678 ")).toBe("12345678");
  });

  it("validates biller number as exactly five digits", () => {
    expect(isValidPayeasyBillerNo("12345")).toBe(true);
    expect(isValidPayeasyBillerNo("1234")).toBe(false);
    expect(isValidPayeasyBillerNo("123456")).toBe(false);
  });

  it("detects any payeasy number", () => {
    expect(hasAnyPayeasyNumber({ payeasy_biller_no: "", payeasy_customer_no: " 123 ", payeasy_confirm_no: "" })).toBe(true);
    expect(hasAnyPayeasyNumber({ payeasy_biller_no: "", payeasy_customer_no: "", payeasy_confirm_no: "" })).toBe(false);
  });
});
