import { describe, expect, it } from "vitest";

import { elapsedBusinessDaysSince, isBusinessDay } from "../business-days";

describe("elapsedBusinessDaysSince", () => {
  it("returns 0 on the same day", () => {
    expect(elapsedBusinessDaysSince("2026-07-06T09:00:00+09:00", "2026-07-06T18:00:00+09:00")).toBe(0);
  });

  it("counts Friday import to Monday as 1 business day", () => {
    expect(elapsedBusinessDaysSince("2026-07-03T10:00:00+09:00", "2026-07-06T09:00:00+09:00")).toBe(1);
  });

  it("counts Friday import to Tuesday as 2 business days", () => {
    expect(elapsedBusinessDaysSince("2026-07-03T10:00:00+09:00", "2026-07-07T09:00:00+09:00")).toBe(2);
  });

  it("does not count weekend days", () => {
    expect(elapsedBusinessDaysSince("2026-07-04T10:00:00+09:00", "2026-07-05T18:00:00+09:00")).toBe(0);
  });

  it("counts a weekend import to Monday as 1 business day", () => {
    expect(elapsedBusinessDaysSince("2026-07-04T10:00:00+09:00", "2026-07-06T09:00:00+09:00")).toBe(1);
  });

  it("returns 0 when the target date is before the imported date", () => {
    expect(elapsedBusinessDaysSince("2026-07-07T09:00:00+09:00", "2026-07-06T09:00:00+09:00")).toBe(0);
  });
});

describe("isBusinessDay", () => {
  it("detects weekdays and weekends", () => {
    expect(isBusinessDay(new Date("2026-07-06T00:00:00Z"))).toBe(true);
    expect(isBusinessDay(new Date("2026-07-05T00:00:00Z"))).toBe(false);
  });
});
