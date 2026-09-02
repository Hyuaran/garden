import { describe, expect, it } from "vitest";
import {
  buildCreditCondition,
  buildCustomerCondition,
  buildKandenCondition,
  buildRosterCondition,
  buildWarnings,
  dedupeRows,
  isMonthEnd,
  type KanriSourceRow,
  sourceEmptyWarning,
  sourceFailedWarning,
  summarizeRows,
} from "./kanri-core";
import { nextModeForDate } from "../KanriPortalClient";

describe("kanri portal core", () => {
  it("builds month range conditions without the moving current-month view", () => {
    expect(buildCustomerCondition("2026-09-02")).toContain('実績日 >= "2026-09-01"');
    expect(buildCustomerCondition("2026-09-02")).toContain('実績日 <= "2026-09-30"');
    expect(buildCreditCondition("2026-09-02")).toContain('日付_4 >= "2026-09-01"');
    expect(buildCreditCondition("2026-09-02")).not.toContain("THIS_MONTH");
  });

  it("does not filter kanden reports by staff name", () => {
    const condition = buildKandenCondition("2026-09-02");
    expect(condition).toContain('report_time in ("最終")');
    expect(condition).toContain('work_date <= "2026-09-30"');
    expect(condition).not.toContain("staff_name in");
  });

  it("includes employees who left during the target month", () => {
    expect(buildRosterCondition("2026-09-02")).toContain('従業員ステータス in ("在籍中")');
    expect(buildRosterCondition("2026-09-02")).toContain('退職日 >= "2026-09-01"');
    expect(buildRosterCondition("2026-09-02")).toContain('退職日 <= "2026-09-30"');
  });

  it("switches to closing when a month end is selected", () => {
    expect(isMonthEnd("2026-09-30")).toBe(true);
    expect(nextModeForDate("2026-09-30", "daily")).toBe("closing");
    expect(nextModeForDate("2026-09-29", "daily")).toBe("daily");
  });

  it("builds all four warning types and keeps data deduped", () => {
    const rows: KanriSourceRow[] = [
      { source: "roster", sourceApp: null, recordId: "1", payload: { 従業員名_姓名: { value: "山田 太郎" } } },
      { source: "kanden_report", sourceApp: null, recordId: "2", payload: { staff_name: { value: "熊野本気" } } },
      { source: "credit_card", sourceApp: "66", recordId: "9", payload: { レコード番号: { value: "9" } } },
      { source: "credit_card", sourceApp: "66", recordId: "9", payload: { レコード番号: { value: "9" } } },
    ];
    const warnings = buildWarnings(rows, [
      sourceEmptyWarning("kintone_customer"),
      sourceFailedWarning("credit_card", "84"),
    ]);

    expect(warnings.map((warning) => warning.code)).toEqual([
      "source_empty",
      "source_failed",
      "staff_not_in_roster",
      "duplicate_record",
    ]);
    expect(warnings[2].message).toBe("訪販の担当者「熊野本気」が従業員名簿にいません");
    expect(dedupeRows(rows)).toHaveLength(3);
  });

  it("summarizes source counts and credit app breakdown", () => {
    const summary = summarizeRows([
      { source: "kintone_customer", sourceApp: null, recordId: "1", payload: {} },
      { source: "credit_card", sourceApp: "66", recordId: "2", payload: {} },
      { source: "credit_card", sourceApp: "84", recordId: "3", payload: {} },
      { source: "roster", sourceApp: null, recordId: "4", payload: {} },
    ]);
    expect(summary.kintone_customer.count).toBe(1);
    expect(summary.credit_card.apps).toEqual({ "66": 1, "84": 1 });
    expect(summary.total).toBe(4);
  });
});
