import { describe, expect, it } from "vitest";
import { bookingFiscalPeriod, isBookingComplete } from "../expense-booking-info";

describe("expense booking info", () => {
  const original = { id: "original", established_on: "2020-04-01", fiscal_end_month: 3 };
  const reassigned = { id: "new", established_on: "2025-01-01", fiscal_end_month: 12 };

  it("calculates the period from the booking corporation", () => {
    expect(bookingFiscalPeriod(original, "2026-02-01")).toBe("第6期");
    expect(bookingFiscalPeriod(reassigned, "2026-02-01")).toBe("第2期");
  });

  it("supports mixed periods row by row", () => {
    expect(["2025-12-31", "2026-01-01"].map((date) => bookingFiscalPeriod(reassigned, date)))
      .toEqual(["第1期", "第2期"]);
  });

  it("uses booking_date as the completion flag", () => {
    expect(isBookingComplete({ booking_date: "2026-08-31" })).toBe(true);
    expect(isBookingComplete({ booking_date: null })).toBe(false);
  });
});
