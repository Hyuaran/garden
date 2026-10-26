import { accountAxes } from "./corporations";
import type { MfAccount, AxisOrder, BalanceSnapshot } from "./types";
export function orderedAxis(keys: string[], axis: AxisOrder["axis"], order: AxisOrder[]) {
 const positions = new Map(order.filter(o => o.axis === axis).map(o => [o.key, o.sort_order]));
 return [...new Set(keys)].sort((a,b) => (positions.get(a) ?? Infinity) - (positions.get(b) ?? Infinity) || a.localeCompare(b, "ja"));
}
// 欄の増減＝取引日が今日の入出金（byAccount）。無いとき（古い API の応答）は今朝 0 時の残高との差（2026-10-26 東海林さん「今日取引があるもの」）
export function summarize(accounts: MfAccount[], snapshots: BalanceSnapshot[], byAccount?: Record<string, { delta: number }>) {
 const automatic = accounts.filter(a => (a.balance_mode === "auto" || (a.balance_mode === "arrival" && a.anchor_balance != null && !!a.anchor_at) || (a.balance_mode === "anchor" && a.anchor_balance != null && !!a.anchor_date)) && a.balance !== null);
 const baseline = new Map(snapshots.map(s => [s.mf_account_id, Number(s.balance)]));
 return { notes: [...new Set(accounts.filter(a => a.balance_mode === "manual_check" && a.balance_note.trim()).map(a => a.balance_note.trim()))], count: accounts.length, manual: accounts.filter(a => (a.balance_mode === "arrival" && (a.anchor_balance == null || !a.anchor_at || a.balance === null)) || a.balance_mode === "manual_check" || (a.balance_mode === "anchor" && (a.anchor_balance == null || !a.anchor_date || a.balance === null))).length,
 balance: automatic.length ? automatic.reduce((s,a) => s + Number(a.balance), 0) : null,
 delta: byAccount ? (automatic.length ? automatic.reduce((s,a) => s + (byAccount[a.mf_account_id]?.delta ?? 0), 0) : null) : automatic.length && automatic.every(a => baseline.has(a.mf_account_id)) ? automatic.reduce((s,a) => s + Number(a.balance) - baseline.get(a.mf_account_id)!, 0) : null,
 pending: accounts.reduce((s,a) => s + a.unjournalized_count, 0) };
}
export function buildMatrix(accounts: MfAccount[], order: AxisOrder[] = [], snapshots: BalanceSnapshot[] = [], byAccount?: Record<string, { delta: number }>) {
 const banks = accounts.filter(a => a.kind === "bank" && !a.hidden).map(a => ({ ...a, ...accountAxes(a.name) }));
 return { corps: orderedAxis([...order.filter(o => o.axis === "corp").map(o => o.key), ...banks.map(a => a.corp_code)], "corp", order), banks: orderedAxis([...order.filter(o => o.axis === "bank").map(o => o.key), ...banks.map(a => a.bank_name)], "bank", order),
 cell: (corp?: string, bank?: string) => summarize(banks.filter(a => (!corp || a.corp_code === corp) && (!bank || a.bank_name === bank)), snapshots, byAccount) };
}
export const deltaLabel = (v: number) => v > 0 ? "↑ +" + v.toLocaleString("ja-JP") : v < 0 ? "↓ ▲" + Math.abs(v).toLocaleString("ja-JP") : "±0";
