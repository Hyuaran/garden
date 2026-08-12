import { describe, expect, it } from "vitest";
import { aggregateDefinitionFixture, aggregateEmployeeDefinitionFixture, classifyResultFlag, defaultCallMetricDates, normalizeCallMetricsRpc, parseCallMetricParams } from "./call-metrics";

describe("call metrics definitions", () => {
  it("calculates the confirmed definition from raw result_flag values", () => {
    const flags = ["留守", "担不", "見込", "無効", "獲得", "トス", "NG", "前確OK", "前確NG", null, "", "想定外"];
    const result = aggregateDefinitionFixture(flags.map((resultFlag) => ({ listName: "A", resultFlag })));
    expect(result.get("A")).toEqual({ callCount: 12, effectiveCount: 8, orderCount: 1, acquiredCount: 1 });
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
    expect(result.get("社員A")).toEqual({ callCount: 2, effectiveCount: 1, orderCount: 1, acquiredCount: 0 });
    expect(result.get("氏名なし")).toEqual({ callCount: 1, effectiveCount: 1, orderCount: 0, acquiredCount: 0 });
  });

  it("normalizes a definition fixture without mixing orders and acquisitions", () => {
    const result = normalizeCallMetricsRpc({
      metrics: [{ list_name: "A", call_count: 11, effective_count: 7, effective_rate: "0.636364", order_count: 1, acquired_count: 1, call_order_rate: "0.090909" }],
      employee_metrics: [{ employee_name: "社員A", call_count: 11, effective_count: 7, effective_rate: "0.636364", order_count: 1, acquired_count: 1, call_order_rate: "0.090909" }],
      result_flags: [
        { result_flag: "留守", count: 1, is_effective: false, is_expected: true },
        { result_flag: "空", count: 2, is_effective: false, is_expected: true },
        { result_flag: "前確OK", count: 1, is_effective: true, is_expected: true },
        { result_flag: "獲得", count: 1, is_effective: true, is_expected: true },
        { result_flag: "新しい値", count: 1, is_effective: true, is_expected: false },
      ],
    }, { from: "2026-08-01", to: "2026-08-12", listName: null });
    expect(result.metrics[0]).toMatchObject({ callCount: 11, effectiveCount: 7, orderCount: 1, acquiredCount: 1 });
    expect(result.employeeMetrics[0]).toMatchObject({ employeeName: "社員A", callCount: 11, effectiveCount: 7, orderCount: 1, acquiredCount: 1 });
    expect(result.resultFlags.at(-1)).toMatchObject({ isEffective: true, isExpected: false });
  });

  it("uses today for both default dates", () => {
    expect(defaultCallMetricDates(new Date("2026-08-12T12:00:00Z"))).toEqual({ from: "2026-08-12", to: "2026-08-12" });
  });

  it("validates dates, order, range and list name", () => {
    expect(parseCallMetricParams(new URLSearchParams("from=2026-08-01&to=2026-08-12&listName=A"))).toEqual({ from: "2026-08-01", to: "2026-08-12", listName: "A" });
    expect(() => parseCallMetricParams(new URLSearchParams("from=bad&to=2026-08-12"))).toThrow("YYYY-MM-DD");
    expect(() => parseCallMetricParams(new URLSearchParams("from=2026-08-13&to=2026-08-12"))).toThrow("開始日");
    expect(() => parseCallMetricParams(new URLSearchParams("from=2025-01-01&to=2026-08-12"))).toThrow("最大366日");
  });
});
