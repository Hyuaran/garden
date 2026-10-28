import { expect, it } from "vitest";
import { dueNotice, noticeMessage, sortForwardings, expiry, type Forwarding } from "./domain";

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
it("日本時間の登録当日には通知しない", () => {
  expect(dueNotice({ ...row, created_at: "2026-10-28T15:01:00Z" }, [], "2026-10-29")).toBeNull();
});
it("待ちは期限切れより上、停止は最後。届出が入ると期限が付き待ち通知は止まる", () => {
  const filed = { ...row, id: "b", filings: [{ id: "f", forwarding_id: "b", filed_on: "2026-10-29", method: "窓口" as const, receipt: "", filed_by: "", notes: "" }] };
  expect(expiry(filed.filings[0].filed_on)).toBe("2027-10-28");
  expect(dueNotice(filed, [], "2026-10-30")).toBeNull();
  expect(sortForwardings([{ ...row, id: "c", stopped: true }, filed, row]).map(r => r.id)).toEqual(["a", "b", "c"]);
});
