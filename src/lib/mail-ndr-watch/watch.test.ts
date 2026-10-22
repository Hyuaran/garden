import { describe, it, expect, vi } from "vitest";
import { classify, isNdr, makeAlert, formatAlert, type Message } from "./parse";
import { runWatch, windowStart, type State, type Dependencies } from "./run";
const now = new Date("2026-10-22T10:00:00Z");
const message: Message = { id: "ndr1", subject: "Undeliverable: 請求書", receivedDateTime: now.toISOString(), body: { content: "Diagnostic information\nSendAsDenied\nTo: A; B\nSent: 2026/10/22 18:30" } };
const alert = makeAlert("keiri@example.com", message);
function setup(initial: State | null = { started_at: "2026-10-22T09:00:00Z", last_run_at: "2026-10-22T09:50:00Z", outage: false, outage_notified: false }) {
  let state = initial;
  const ids = new Set<string>();
  const deps: Dependencies = {
    readState: vi.fn(async () => state),
    initialize: vi.fn(async started_at => state = { started_at, last_run_at: null, outage: false, outage_notified: false }),
    lock: vi.fn(async () => true), unlock: vi.fn(async () => {}),
    saveState: vi.fn(async s => { state = { ...s }; }),
    known: vi.fn(async id => ids.has(id)), saveAlert: vi.fn(async a => { ids.add(a.message_id); }),
    collect: vi.fn(async () => [alert]), send: vi.fn(async () => {}),
  };
  return deps;
}
describe("NDR detection and parsing", () => {
  it.each(["SendAsDenied", "ec=1244", "代理として送信するアクセス権がありません", "SOBO rights"])("classifies permission marker %s", marker => expect(classify(marker)).toBe("SendAsDenied（送信権限不足）"));
  it.each([["RESOLVER.ADR", "宛先不明"], ["550 5.1.1", "宛先不明"], ["RecipientNotFound", "宛先不明"], ["存在しません", "宛先不明"], ["550 5.7.520", "外部転送ブロック"], ["5.2.2", "容量・サイズ超過"], ["5.3.4", "容量・サイズ超過"], ["mailbox full", "容量・サイズ超過"], ["容量", "容量・サイズ超過"], ["サイズ", "容量・サイズ超過"], ["unknown", "その他"]])("classifies %s", (text, kind) => expect(classify(text)).toBe(kind));
  it("requires diagnostics even for NDR senders and subjects", () => {
    expect(isNdr(message)).toBe(true);
    for (const from of [{ address: "postmaster@example.com" }, { address: "MicrosoftExchange123@example.com" }, { name: "Microsoft Outlook" }, { name: "System Administrator" }, { name: "Mail Delivery Subsystem" }]) {
      expect(isNdr({ ...message, subject: "", from: { emailAddress: from } })).toBe(true);
      expect(isNdr({ subject: "Undeliverable: hello", from: { emailAddress: from }, id: "x", body: { content: "普通のお知らせ" } })).toBe(false);
    }
    expect(isNdr({ id: "x", subject: "請求書のサイズ", body: { content: "ご確認ください" } })).toBe(false);
    // 差出人・件名が NDR らしくないものは、本文に診断情報らしい文字があっても拾わない（メルマガの誤検知を防ぐ）
    expect(isNdr({ id: "x", body: { content: "#550 5.9.9" } })).toBe(false);
  });
  it("extracts attachment fields and falls back to body lines", () => {
    expect(alert).toMatchObject({ original_subject: "請求書", recipients: "A 他1件", original_sent_at: "2026-10-22T09:30:00.000Z" });
    expect(makeAlert("box", message, { id: "original", subject: "original subject", sentDateTime: "2026-10-22T08:00:00Z", toRecipients: [{ emailAddress: { name: "Alice", address: "a@example.com" } }] })).toMatchObject({ original_subject: "original subject", recipients: "Alice", original_sent_at: "2026-10-22T08:00:00.000Z" });
    expect(makeAlert("box", { id: "x" })).toMatchObject({ original_subject: "記録なし", recipients: "記録なし", original_sent_at: null });
  });
  it("formats JST and missing fields", () => {
    expect(formatAlert(alert)).toBe("[info][title]メール送信失敗を検知[/title]\n種別：SendAsDenied（送信権限不足）\n差出人アカウント：keiri@example.com\n元件名：請求書\n送信日時：2026/10/22 18:30\n宛先：A 他1件\nNDR受信：2026/10/22 19:00\n→ 相手に届いていません。再送が必要です。[/info]");
    expect(formatAlert({ ...alert, original_sent_at: null })).toContain("送信日時：記録なし");
  });
});
describe("watch lifecycle", () => {
  it("overlaps by 15 minutes without crossing startup", () => {
    expect(windowStart({ started_at: "2026-10-22T09:00:00Z", last_run_at: "2026-10-22T09:50:00Z", outage: false, outage_notified: false })).toBe("2026-10-22T09:35:00.000Z");
  });
  it("does not resend notified IDs", async () => {
    const deps = setup(); await runWatch(deps, false, now); await runWatch(deps, false, now);
    expect(deps.send).toHaveBeenCalledTimes(1);
  });
  it("initializes at now and excludes history", async () => {
    const deps = setup(null);
    vi.mocked(deps.collect).mockResolvedValue([{ ...alert, received_at: "2026-10-21T10:00:00Z" }]);
    await runWatch(deps, false, now);
    expect(deps.initialize).toHaveBeenCalledWith(now.toISOString()); expect(deps.send).not.toHaveBeenCalled();
  });
  it("dry run returns discoveries without any writes or sends", async () => {
    const deps = setup(); expect(await runWatch(deps, true, now)).toMatchObject({ ok: true, alerts: [alert] });
    for (const fn of [deps.lock, deps.unlock, deps.initialize, deps.saveAlert, deps.saveState, deps.send]) expect(fn).not.toHaveBeenCalled();
    const fresh = setup(null); await runWatch(fresh, true, now); expect(fresh.initialize).not.toHaveBeenCalled();
  });
  it("notifies once per outage and once after recovery", async () => {
    const deps = setup(); vi.mocked(deps.collect).mockRejectedValue(new Error("Graph unavailable"));
    await runWatch(deps, false, now); await runWatch(deps, false, now);
    expect(deps.send).toHaveBeenCalledTimes(1);
    vi.mocked(deps.collect).mockResolvedValue([]);
    await runWatch(deps, false, now); await runWatch(deps, false, now);
    expect(vi.mocked(deps.send).mock.calls.map(c => c[0])).toEqual(["送信失敗の見張りが止まっています", "復旧しました"]);
  });
  it("retries failed Chatwork notifications on recovery and does not record an unsent NDR", async () => {
    const deps = setup(); vi.mocked(deps.send).mockRejectedValue(new Error("Chatwork unavailable"));
    await runWatch(deps, false, now); expect(deps.saveAlert).not.toHaveBeenCalled();
    vi.mocked(deps.send).mockResolvedValue(); vi.mocked(deps.collect).mockResolvedValue([]);
    await runWatch(deps, false, now);
    expect(vi.mocked(deps.send).mock.calls.slice(-2).map(c => c[0])).toEqual(["送信失敗の見張りが止まっています", "復旧しました"]);
  });
  it("skips concurrent runs", async () => {
    const deps = setup(); vi.mocked(deps.lock).mockResolvedValue(false);
    expect(await runWatch(deps, false, now)).toMatchObject({ skipped: true }); expect(deps.collect).not.toHaveBeenCalled();
  });
});

import { isNdr as isNdrReal, makeAlert as makeAlertReal } from "./parse";
it("detects the Exchange 配信不能 report with an empty body and infers SendAsDenied from From/Sender", () => {
  const ndr = { id: "n1", subject: "配信不能: 申込書不備案件（MX）", receivedDateTime: "2026-10-22T09:30:18Z", from: { emailAddress: { name: "システム管理者", address: "システム管理者" } }, body: { content: "" },
    reportText: "Delivery has failed to these recipients or groups:\nContent-Type: message/delivery-status\nFinal-recipient: RFC822; watanabe-h@mxmobiling.com\nAction: failed\nStatus: 5.4.0" };
  expect(isNdrReal(ndr)).toBe(true);
  const original = { id: "o1", subject: "RE: 申込書不備案件（MX）", sentDateTime: "2026-10-22T09:30:16Z", from: { emailAddress: { address: "cs@hyuaran.com" } }, sender: { emailAddress: { address: "keiri@hyuaran1.onmicrosoft.com" } }, toRecipients: [{ emailAddress: { name: "Watanabe Hidetaka-MXM" } }, { emailAddress: { name: "ヒュアランcs" } }] };
  const alert = makeAlertReal("keiri@hyuaran1.onmicrosoft.com", ndr, original);
  expect(alert.kind).toBe("SendAsDenied（送信権限不足・差出人 cs@hyuaran.com）");
  expect(alert.recipients).toBe("Watanabe Hidetaka-MXM 他1件");
  expect(makeAlertReal("keiri@hyuaran1.onmicrosoft.com", ndr, { ...original, from: { emailAddress: { address: "keiri@hyuaran1.onmicrosoft.com" } } }).kind).toBe("その他");
  expect(isNdrReal({ ...ndr, from: { emailAddress: { name: "Chatwork", address: "news@ns.chatwork.com" } }, subject: "お知らせ" })).toBe(false);
});
