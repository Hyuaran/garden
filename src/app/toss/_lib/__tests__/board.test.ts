import { describe, expect, it } from "vitest";
import { toBoardRow } from "../board";
import type { KintoneRecord } from "../kintone.server";

const record = (values: Record<string, unknown>): KintoneRecord => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }]));

describe("toBoardRow", () => {
  it("shows an order before call history", () => {
    const row = toBoardRow(record({ 日付_0: "2026-08-01", コール履歴: [{ value: { 対応日: { value: "2026-07-31" }, 対応結果: { value: "架電" } } }] }));
    expect(row.status).toBe("受注"); expect(row.latestActivity).toBe("2026-08-01");
  });
  it("uses the later terminal event when both exist", () => {
    expect(toBoardRow(record({ 日付_0: "2026-08-01", 日付_4: "2026-08-02" })).status).toBe("キャンセル");
  });
  it("shows in progress when only call history exists", () => {
    const row = toBoardRow(record({ コール履歴: [{ value: { 日時: { value: "2026-08-01" }, 結果: { value: "アポ" } } }] }));
    expect(row.status).toBe("対応中"); expect(row.latestCall).toBe("アポ");
  });
  it("falls back to reception and updated time", () => {
    const row = toBoardRow(record({ 更新日時: "2026-08-01T10:00:00Z" }));
    expect(row.status).toBe("連携受付"); expect(row.latestActivity).toBe("2026-08-01T10:00:00Z");
  });
});
