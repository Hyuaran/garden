import { describe, expect, it, test } from "vitest";
import { LEGACY_CANCEL_REASON, orderStatus, performanceMonth, type StatusInput } from "./status";

const date = "2026-11-01";
const stages = [
  ["specs_on", "エントリー待ち"], ["entered_on", "申込書待ち"],
  ["application_received_on", "郵送待ち"], ["mailed_on", "入金待ち"],
  ["paid_on", "完了"], ["refunded_on", "キャンセル"],
] as const;

test("日付の進んだ段階を優先し、手動の保留と差し戻しを最優先する", () => {
  const order: StatusInput = { ordered_on: date };
  expect(orderStatus(order)).toBe("諸元待ち");
  for (const [field, status] of stages) {
    order[field] = date;
    expect(orderStatus(order)).toBe(status);
  }
  expect(orderStatus({ ...order, status: "保留" })).toBe("保留");
  expect(orderStatus({ ...order, status: "差し戻し" })).toBe("差し戻し");
  expect(orderStatus({ cancelled_on: date, paid_on: date })).toBe("キャンセル");
});

test("写メと TimeTree ラベルでも諸元を確認する", () => {
  expect(orderStatus({}, true)).toBe("諸元待ち");
  expect(orderStatus({ timetree_label: " エントリー待ち " })).toBe("エントリー待ち");
  expect(orderStatus({ timetree_label: "諸元待ち" })).toBe("諸元待ち");
  expect(orderStatus({ timetree_label: " " })).toBe("諸元待ち");
});

test("旧案件の郵送前キャンセルは入金が見つかれば完了する", () => {
  const order = { status: "キャンセル", cancel_reason: LEGACY_CANCEL_REASON } as const;
  expect(orderStatus(order)).toBe("キャンセル");
  expect(orderStatus({ ...order, status: "保留" })).toBe("保留");
  expect(orderStatus({ ...order, status: null })).toBe("キャンセル");
  expect(orderStatus({ ...order, paid_on: date })).toBe("完了");
  expect(orderStatus({ ...order, entered_on: date, mailed_on: date })).toBe("入金待ち");
});

test("実績月が空の場合は受注月を使う", () => {
  expect(performanceMonth({ ordered_on: date, jisseki_month: "" })).toBe("2026-11");
  expect(performanceMonth({ ordered_on: date, jisseki_month: "2026-12" })).toBe("2026-12");
  expect(performanceMonth({})).toBeNull();
});

describe("明細なし（完了扱い）", () => {
  it("郵送済みで印があれば完了・戻入があればキャンセル", async () => {
    const { orderStatus, LEGACY_DONE_REASON } = await import("./status");
    expect(orderStatus({ mailed_on: "2024-07-01", cancel_reason: LEGACY_DONE_REASON })).toBe("完了");
    expect(orderStatus({ mailed_on: "2024-07-01", cancel_reason: LEGACY_DONE_REASON, refunded_on: "2024-09-01" })).toBe("キャンセル");
    expect(orderStatus({ cancel_reason: LEGACY_DONE_REASON })).toBe("諸元待ち");
  });
});

describe("請求前キャンセル（TimeTree）", () => {
  it("キャンセルになる・入金があれば完了", async () => {
    const { orderStatus, TIMETREE_CANCEL_REASON } = await import("./status");
    expect(orderStatus({ cancel_reason: TIMETREE_CANCEL_REASON, timetree_label: "請求前キャンセル" })).toBe("キャンセル");
    expect(orderStatus({ cancel_reason: TIMETREE_CANCEL_REASON, paid_on: "2026-01-01" })).toBe("完了");
  });
});
