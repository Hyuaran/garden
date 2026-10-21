import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import BankAccounts from "./BankAccounts";
import LinkAlerts from "./LinkAlerts";
import type { LinkAlert } from "@/lib/bud/mf/link-alerts";
import type { MfAccount } from "@/lib/bud/mf/types";
// テストの画面には <dialog> の開閉が無いので代わりを置く（お知らせのテストと同じ）
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.removeAttribute("open"); };


const account: MfAccount = { mf_account_id: "a", name: "京都銀行｜HR", kind: "bank", sub_account_label: "", sort_order: 0, hidden: false, visible_employee_ids: ["e"], book_sub_account_name: "", balance_mode: "manual_check", balance_note: "", balance: null, unjournalized_count: 0, fetched_at: "2026-10-21T00:00:00Z" };
const makeAlert = (): LinkAlert => ({ id: "alert", message_id: "mail", received_at: new Date().toISOString(), mail_account_name: "京都銀行_MS", last_success_date: "2026-08-11", reason: "認証", reason_text: "お客様による再連携操作が必要なため。", mf_account_id: "a", dismissed_at: null, dismissed_by: null, active: true });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("合計の上に法人名付きの知らせを出し、確認の窓で完了にすると口座の印と一緒に消える", async () => {
 const fetcher = vi.fn(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method ? { ok: true } : url.endsWith("/link-alerts") ? { alerts: [makeAlert()] } : { accounts: [account], transactions: [], employees: [], admin: false })));
 vi.stubGlobal("fetch", fetcher);
 render(<BankAccounts />);
 const notice = await screen.findByText(/マネーフォワードで自動取得が止まっている可能性あり：京都銀行（ヒュアラン）/);
 expect(notice).toHaveTextContent("26/8/11 ～");
 expect(notice.compareDocumentPosition(screen.getByText("グループ合計")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.getAllByRole("img", { name: "自動取得が止まっています" })).toHaveLength(2);
 fireEvent.click(screen.getByRole("button", { name: "京都銀行（ヒュアラン）の知らせを完了にする" }));
 // 押し間違いを防ぐ確認の窓：やめると何も起きない／完了にすると消える
 fireEvent.click(await screen.findByRole("button", { name: "やめる" }));
 expect(fetcher).not.toHaveBeenCalledWith("/api/bud/mf-accounts/link-alerts", expect.objectContaining({ method: "PATCH" }));
 fireEvent.click(screen.getByRole("button", { name: "京都銀行（ヒュアラン）の知らせを完了にする" }));
 fireEvent.click(await screen.findByRole("button", { name: "完了にする" }));
 await waitFor(() => expect(screen.queryByRole("img", { name: "自動取得が止まっています" })).not.toBeInTheDocument());
 expect(fetcher).toHaveBeenCalledWith("/api/bud/mf-accounts/link-alerts", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ id: "alert" }) }));
});
it("結び付かない口座はメールの名前で出し、完了にできなければ残す", async () => {
 vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method ? {} : { alerts: [{ ...makeAlert(), mf_account_id: null }] }), { status: init?.method ? 403 : 200 })));
 render(<LinkAlerts accounts={[]} onChange={() => {}} />);
 const button = await screen.findByRole("button", { name: "京都銀行_MSの知らせを完了にする" });
 fireEvent.click(button);
 fireEvent.click(await screen.findByRole("button", { name: "完了にする" }));
 expect(await screen.findByRole("alert")).toHaveTextContent("完了にできませんでした");
 expect(button).toBeInTheDocument();
});
it("画面を開いたままでも8日経過時に印を消す", async () => {
 vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-21T03:00:00Z"));
 const alert = { ...makeAlert(), received_at: "2026-10-13T03:00:01Z" };
 vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ alerts: [alert] }))));
 const onChange = vi.fn();
 await act(async () => { render(<LinkAlerts accounts={[]} onChange={onChange} />); });
 expect(screen.getByRole("img", { name: "自動取得が止まっています" })).toBeInTheDocument();
 await act(async () => { vi.advanceTimersByTime(1000); });
 expect(screen.queryByRole("img", { name: "自動取得が止まっています" })).not.toBeInTheDocument();
 expect(onChange).toHaveBeenLastCalledWith([]);
});
