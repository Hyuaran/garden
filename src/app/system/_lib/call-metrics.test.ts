import { describe, expect, it } from "vitest";
import { aggregateDefinitionFixture, aggregateEmployeeDefinitionFixture, callsPerWorkHour, classifyResultFlag, defaultCallMetricDates, formatWorkTime, normalizeCallMetricsRpc, parseCallMetricParams, summarizeCallMetrics } from "./call-metrics";

describe("call metrics definitions", () => {
  it("calculates the confirmed definition from raw result_flag values", () => {
    const flags = ["留守", "担不", "見込", "無効", "獲得", "トス", "NG", "前確OK", "前確NG", null, "", "想定外"];
    const result = aggregateDefinitionFixture(flags.map((resultFlag) => ({ listName: "A", resultFlag })));
    expect(result.get("A")).toEqual({ callCount: 12, effectiveCount: 8, orderCount: 1, acquiredCount: 1, tossCount: 1 });
    expect(classifyResultFlag("想定外")).toMatchObject({ isEffective: true, isExpected: false });
    expect(classifyResultFlag("  ")).toMatchObject({ isEffective: false, isExpected: true });
  });

  it("keeps lists separate and exposes blank list names", () => {
    const result = aggregateDefinitionFixture([
      { listName: "A", resultFlag: "前確OK" },
      { listName: "B", resultFlag: "留守" },
      { listName: null, resultFlag: "獲得" },
    ]);
    expect(result.get("A")?.orderCount).toBe(1);
    expect(result.get("B")?.effectiveCount).toBe(0);
    expect(result.get("リスト名なし")?.acquiredCount).toBe(1);
  });

  it("uses the same confirmed definition for employees and exposes blank names", () => {
    const result = aggregateEmployeeDefinitionFixture([
      { employeeName: "社員A", resultFlag: "前確OK" },
      { employeeName: "社員A", resultFlag: "無効" },
      { employeeName: null, resultFlag: "想定外" },
    ]);
    expect(result.get("社員A")).toEqual({ callCount: 2, effectiveCount: 1, orderCount: 1, acquiredCount: 0, tossCount: 0 });
    expect(result.get("氏名なし")).toEqual({ callCount: 1, effectiveCount: 1, orderCount: 0, acquiredCount: 0, tossCount: 0 });
  });

  it("normalizes a definition fixture without mixing orders and acquisitions", () => {
    const result = normalizeCallMetricsRpc({
      metrics: [{ list_name: "A", call_count: 11, effective_count: 7, effective_rate: "0.636364", toss_count: 2, order_count: 1, acquired_count: 3, call_order_rate: "0.090909", call_acquired_rate: "0.272727" }],
      employee_metrics: [{ employee_name: "社員A", call_count: 11, effective_count: 7, effective_rate: "0.636364", toss_count: 2, order_count: 1, acquired_count: 3, call_order_rate: "0.090909", call_acquired_rate: "0.272727", prospect_count: 4, absent_count: 5, away_count: 6, invalid_count: 7, work_seconds: 18856 }],
      last_imported_at: "2026-08-12T03:34:00Z",
    }, { from: "2026-08-01", to: "2026-08-12", listName: "A", employeeName: "社員A" });
    expect(result.metrics[0]).toMatchObject({ callCount: 11, effectiveCount: 7, tossCount: 2, orderCount: 1, acquiredCount: 3, callOrderRate: .090909, callAcquiredRate: .272727 });
    expect(result.employeeMetrics[0]).toMatchObject({ employeeName: "社員A", callCount: 11, effectiveCount: 7, tossCount: 2, orderCount: 1, acquiredCount: 3, prospectCount: 4, absentCount: 5, awayCount: 6, invalidCount: 7, workSeconds: 18856 });
    expect(result).toMatchObject({ listName: "A", employeeName: "社員A", lastImportedAt: "2026-08-12T03:34:00Z" });
  });

  it("formats work seconds and calculates calls per work hour safely", () => {
    expect(formatWorkTime(18856)).toBe("5:14:16");
    expect(formatWorkTime(0)).toBe("0:00:00");
    expect(formatWorkTime(-1)).toBe("0:00:00");
    expect(callsPerWorkHour(171, 18856)).toBeCloseTo(32.6463725);
    expect(callsPerWorkHour(10, 0)).toBeNull();
  });

  it("uses today for both default dates", () => {
    expect(defaultCallMetricDates(new Date("2026-08-12T12:00:00Z"))).toEqual({ from: "2026-08-12", to: "2026-08-12" });
  });

  it("validates dates, order, range and both filters", () => {
    expect(parseCallMetricParams(new URLSearchParams("from=2026-08-01&to=2026-08-12&listName=A&employeeName=B"))).toEqual({ from: "2026-08-01", to: "2026-08-12", listName: "A", employeeName: "B" });
    expect(() => parseCallMetricParams(new URLSearchParams("from=bad&to=2026-08-12"))).toThrow("YYYY-MM-DD");
    expect(() => parseCallMetricParams(new URLSearchParams("from=2026-08-13&to=2026-08-12"))).toThrow("開始日");
    expect(() => parseCallMetricParams(new URLSearchParams("from=2025-01-01&to=2026-08-12"))).toThrow("最大366日");
  });

  it("summarizes with the same overall definitions as the portal", () => {
    const data = normalizeCallMetricsRpc({
      metrics: [{ list_name: "A", call_count: 1517 }],
      employee_metrics: [
        { employee_name: "A", call_count: 1000, effective_count: 600, toss_count: 12, order_count: 30, acquired_count: 20 },
        { employee_name: "B", call_count: 517, effective_count: 310, toss_count: 8, order_count: 15, acquired_count: 10 },
      ],
    }, { from: "2026-08-12", to: "2026-08-12", listName: null, employeeName: null });
    expect(summarizeCallMetrics(data)).toEqual({ employeeCount: 2, totalCalls: 1517, totalEffective: 910, totalOrders: 45, totalAcquired: 30, totalTosses: 20, averageCalls: 758.5, effectiveRate: 910 / 1517, acquiredRate: 30 / 1517, preconfirmRate: 45 / 1517 });
  });
});
