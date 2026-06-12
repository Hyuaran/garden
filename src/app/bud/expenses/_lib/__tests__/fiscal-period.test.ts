import { describe, expect, it } from "vitest";

import { calculateFiscalPeriod } from "../fiscal-period";

const TODAY = new Date("2026-06-12T00:00:00+09:00");

describe("calculateFiscalPeriod", () => {
  it("calculates Hyuaran period 10 before March fiscal year end", () => {
    const period = calculateFiscalPeriod("2016-04-08", 3, "2026-03-01", TODAY);
    expect(period).toMatchObject({
      periodNo: 10,
      start: "2025-04-01",
      end: "2026-03-31",
      deadline: "2026-04-30",
      expired: true,
    });
  });

  it("moves Hyuaran to period 11 from April 1", () => {
    const period = calculateFiscalPeriod("2016-04-08", 3, "2026-04-01", TODAY);
    expect(period).toMatchObject({
      periodNo: 11,
      start: "2026-04-01",
      end: "2027-03-31",
    });
  });

  it("supports a short first period when established in the fiscal end month", () => {
    const period = calculateFiscalPeriod("2021-01-13", 1, "2021-01-20", TODAY);
    expect(period).toMatchObject({
      periodNo: 1,
      start: "2021-01-13",
      end: "2021-01-31",
    });
  });

  it("keeps Ichi July 2025 in the first period", () => {
    const period = calculateFiscalPeriod("2025-06-06", 5, "2025-07-01", TODAY);
    expect(period).toMatchObject({
      periodNo: 1,
      start: "2025-06-06",
      end: "2026-05-31",
    });
  });

  it("returns null when fiscal master values are missing", () => {
    expect(calculateFiscalPeriod(null, 3, "2026-03-01", TODAY)).toBeNull();
    expect(calculateFiscalPeriod("2016-04-08", null, "2026-03-01", TODAY)).toBeNull();
  });

  it("returns null for dates before establishment", () => {
    expect(calculateFiscalPeriod("2025-06-06", 5, "2025-06-05", TODAY)).toBeNull();
  });

  it("treats the deadline date as still in time and the following day as expired", () => {
    const onDeadline = calculateFiscalPeriod("2016-04-08", 3, "2026-03-01", new Date("2026-04-30T12:00:00+09:00"));
    const nextDay = calculateFiscalPeriod("2016-04-08", 3, "2026-03-01", new Date("2026-05-01T00:00:00+09:00"));
    expect(onDeadline?.expired).toBe(false);
    expect(nextDay?.expired).toBe(true);
  });
});
