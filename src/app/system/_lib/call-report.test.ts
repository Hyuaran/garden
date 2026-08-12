import { describe, expect, it } from "vitest";
import { buildCallReport, jstDateString, parseReportDate } from "./call-report";
import type { CallMetricsSummary } from "./call-metrics";

const summary: CallMetricsSummary = { employeeCount: 15, totalCalls: 1517, totalEffective: 910, totalOrders: 45, totalAcquired: 30, averageCalls: 1517 / 15, effectiveRate: 910 / 1517, orderRate: 45 / 1517 };

describe("call report", () => {
  it("formats the confirmed text in JST with Japanese weekday and rounding", () => {
    const result = buildCallReport(summary, new Date("2026-08-12T06:04:00Z"));
    expect(result.skipped).toBe(false);
    expect(result.text).toContain("2026/08/12(水) 15:04");
    expect(result.text).toContain("従業員15名／総コール1,517件");
    expect(result.text).toContain("平均コール数：101 件");
    expect(result.text).toContain("有効率：60.0％");
    expect(result.text).toContain("受注率：3.0％（受注45件／獲得30件）");
  });
  it("skips zero-call days without text", () => {
    expect(buildCallReport({ ...summary, totalCalls: 0 })).toEqual({ skipped: true, reason: "本日コール0件", text: null });
  });
  it("uses the JST calendar date and validates explicit dates", () => {
    const now = new Date("2026-08-11T15:30:00Z");
    expect(jstDateString(now)).toBe("2026-08-12");
    expect(parseReportDate(undefined, now)).toBe("2026-08-12");
    expect(parseReportDate("2026-02-28")).toBe("2026-02-28");
    expect(() => parseReportDate("2026-02-30")).toThrow("YYYY-MM-DD");
  });
});
