import { expect, it, vi } from "vitest";
import { dueNotice, noticeMessage, sortForwardings, expiry, type Forwarding } from "./domain";
import { deliverNotices } from "./notify";

const row: Forwarding = { id: "a", holder: "会社", from_address: "元", to_address: "先", notes: "", stopped: false, created_at: "2026-10-28T14:00:00Z", filings: [] };
it("登録の翌朝から、月曜日をキーに週1回だけ通知する", () => {
  expect(dueNotice(row, [], "2026-10-28")).toBeNull();
  const notice = dueNotice(row, [], "2026-10-29")!;
  expect(notice).toEqual({ forwarding_id: "a", filed_on: "2026-10-26", stage: "unfiled" });
  const sent = [{ ...notice, sent_at: "2026-10-29" }];
  expect(dueNotice(row, sent, "2026-11-01")).toBeNull();
  expect(dueNotice(row, sent, "2026-11-02")?.filed_on).toBe("2026-11-02");
  expect(dueNotice({ ...row, stopped: true }, [], "2026-10-29")).toBeNull();
  expect(noticeMessage(row, notice, "2026-10-29")).toContain("［届け出た］");
});
it("届出待ちは TO なしの 1 通にまとめ、期限の知らせは今までどおり 1 件ずつ TO 付き", async () => {
  const b = { ...row, id: "b", holder: "会社B" };
  const old = { ...row, id: "c", holder: "会社C", filings: [{ id: "f", forwarding_id: "c", filed_on: "2025-10-30", method: "e転居" as const, receipt: "", filed_by: "", notes: "" }] };
  const store = { claim: vi.fn(async () => true), sent: vi.fn(async () => {}), release: vi.fn(async () => {}) };
  const send = vi.fn(async (_message: string, _mention: boolean) => {});
  const results = await deliverNotices([row, b, old], [], "2026-10-29", false, store, send);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[0][1]).toBe(true);
  expect(send.mock.calls[1][1]).toBe(false);
  expect(send.mock.calls[1][0]).toContain("（2 件）");
  expect(send.mock.calls[1][0]).toContain("2. 会社B");
  expect(store.sent).toHaveBeenCalledTimes(3);
  expect(results.filter(r => r.stage === "unfiled").map(r => r.status)).toEqual(["sent", "sent"]);
  send.mockRejectedValueOnce(new Error("x")).mockRejectedValueOnce(new Error("x"));
  store.release.mockClear();
  await deliverNotices([row, b], [], "2026-10-29", false, store, send);
  expect(store.release).toHaveBeenCalledTimes(2);
});
it("日本時間の登録当日には通知しない", () => {
  expect(dueNotice({ ...row, created_at: "2026-10-28T15:01:00Z" }, [], "2026-10-29")).toBeNull();
});
it("待ちは期限切れより上、停止は最後。届出が入ると期限が付き待ち通知は止まる", () => {
  const filed = { ...row, id: "b", filings: [{ id: "f", forwarding_id: "b", filed_on: "2026-10-29", method: "窓口" as const, receipt: "", filed_by: "", notes: "" }] };
  expect(expiry(filed.filings[0].filed_on)).toBe("2027-10-28");
  expect(dueNotice(filed, [], "2026-10-30")).toBeNull();
  expect(sortForwardings([{ ...row, id: "c", stopped: true }, filed, row]).map(r => r.id)).toEqual(["a", "b", "c"]);
});
