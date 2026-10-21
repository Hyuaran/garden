import { describe, expect, it, vi } from "vitest";
import { matchLinkAccount, parseLinkAlerts, syncLinkAlerts, visibleLinkAlerts, type LinkAlert } from "./link-alerts";
import type { SupabaseClient } from "@supabase/supabase-js";
const graph = vi.hoisted(() => ({ token: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/mail-payment-check/graph-mail", () => ({ getGraphToken: graph.token, graphFetch: graph.fetch }));
const text = `連携口座    最終連携成功日 理由
みずほ銀行_MS        2026年09月18日     (認証)
PayPay銀行_HR     2026年09月03日     (認証)
京都銀行_MS 2026年08月11日     (認証)
取得停止の理由
(認証)    お客様による再連携操作が必要なため。`;
describe("知らせメールの読み取り", () => {
 it("3口座の日付と理由を読む", () => {
  const rows = parseLinkAlerts(text);
  expect(rows).toHaveLength(3);
  expect(rows[2]).toEqual({ mail_account_name: "京都銀行_MS", last_success_date: "2026-08-11", reason: "認証", reason_text: "お客様による再連携操作が必要なため。" });
 });
 it("1口座と表なしを扱う", () => {
  expect(parseLinkAlerts("口座 A 2026年9月3日 （認証）")).toHaveLength(1);
  expect(parseLinkAlerts("自動取得が止まっている口座はありません")).toEqual([]);
  expect(() => parseLinkAlerts("口座 2026年02月30日 (認証)")).toThrow();
 });
 it("指定した名前を優先し、補助科目名の前方一致で結び付ける", () => {
  const accounts = [{ mf_account_id: "a", mail_alias: "京都銀行_MS", book_sub_account_name: "" }, { mf_account_id: "b", mail_alias: null, book_sub_account_name: "京都銀行_MS難波支店" }];
  expect(matchLinkAccount("京都銀行_MS", accounts)).toBe("a");
  expect(matchLinkAccount("京都銀行_MS", accounts.slice(1))).toBe("b");
  expect(matchLinkAccount("他の銀行", accounts)).toBeNull();
  expect(matchLinkAccount("京都銀行_MS", [...accounts, { ...accounts[0], mf_account_id: "c" }])).toBeNull();
 });
});
const now = new Date("2026-10-21T03:00:00Z");
const alert: LinkAlert = { ...parseLinkAlerts(text)[0], id: "a", message_id: "m", received_at: "2026-10-20T00:00:00Z", mf_account_id: null, dismissed_at: null, dismissed_by: null, active: true };
it("新しいメールに無い、8日経過、手動消去で消え、後のメールでは再び出す", () => {
 expect(visibleLinkAlerts([alert], now)).toHaveLength(1);
 expect(visibleLinkAlerts([{ ...alert, active: false }], now)).toEqual([]);
 expect(visibleLinkAlerts([{ ...alert, received_at: "2026-10-13T03:00:00Z" }], now)).toEqual([]);
 expect(visibleLinkAlerts([{ ...alert, dismissed_at: "2026-10-20T01:00:00Z" }], now)).toEqual([]);
 expect(visibleLinkAlerts([{ ...alert, dismissed_at: "2026-10-19T01:00:00Z" }], now)).toHaveLength(1);
});
it("2つの受信箱を読み、重複と表なしもまとめて保存する。メールは変更しない", async () => {
 graph.token.mockResolvedValue("token");
 const message = { id: "graph-id", internetMessageId: "same-mail", receivedDateTime: alert.received_at, subject: "自動取得が行なわれていない金融機関", body: { contentType: "text", content: text } };
 graph.fetch.mockResolvedValue({ ok: true, json: async () => ({ value: [message, { ...message, internetMessageId: "empty", body: { contentType: "text", content: "該当なし" } }] }) });
 const rpc = vi.fn().mockResolvedValue({ error: null });
 const db = { from: () => ({ select: async () => ({ data: [], error: null }) }), rpc } as unknown as SupabaseClient;
 expect(await syncLinkAlerts(db, now)).toEqual({ ok: true, messages: 2 });
 expect(graph.fetch).toHaveBeenCalledTimes(2);
 for (const [url, init] of graph.fetch.mock.calls) {
  expect(url).toContain("/mailFolders/inbox/messages?");
  expect(decodeURIComponent(url)).toContain("biz.feedback@moneyforward.com");
  expect(init.method).toBeUndefined();
 }
 expect(rpc.mock.calls[0][1].p_messages.find((m: { message_id: string }) => m.message_id === "empty").alerts).toEqual([]);
});
