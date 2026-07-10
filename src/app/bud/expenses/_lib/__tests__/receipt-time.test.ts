import { describe, expect, it } from "vitest";

import { isReceiptTimeMissing } from "../receipt-time";

describe("isReceiptTimeMissing", () => {
  it("detects empty receipt time values", () => {
    expect(isReceiptTimeMissing("")).toBe(true);
    expect(isReceiptTimeMissing("   ")).toBe(true);
    expect(isReceiptTimeMissing(null)).toBe(true);
    expect(isReceiptTimeMissing(undefined)).toBe(true);
  });

  it("keeps entered receipt time values normal", () => {
    expect(isReceiptTimeMissing("09:30")).toBe(false);
  });
});
