import { describe, expect, it } from "vitest";

import { effectivePaymentDate, isBusinessDay, previousBusinessDay } from "./business-day";

describe("business day", () => {
  it("treats weekends, holidays, substitute holidays, and year-end days as non-business days", () => {
    expect(isBusinessDay("2026-10-10")).toBe(false);
    expect(isBusinessDay("2026-11-03")).toBe(false);
    expect(isBusinessDay("2026-05-06")).toBe(false);
    expect(isBusinessDay("2026-12-30")).toBe(false);
    expect(isBusinessDay("2027-01-03")).toBe(false);
    expect(isBusinessDay("2027-01-04")).toBe(true);
  });

  it("moves payment dates to the previous business day", () => {
    expect(effectivePaymentDate("2026-10-10")).toBe("2026-10-09");
    expect(effectivePaymentDate("2026-11-03")).toBe("2026-11-02");
    expect(effectivePaymentDate("2027-01-03")).toBe("2026-12-29");
    expect(previousBusinessDay("2027-01-04")).toBe("2026-12-29");
  });
});
