import { monthRange } from "./balances";
import type { CardTransaction, MfAccount } from "./types";

export function transactionRange(period: string, fiscalStart?: string | null, now = new Date()) {
  const range = monthRange(period, now);
  if (period === "year") {
    if (!fiscalStart) throw new Error("今年度の取引を読み直してください");
    return { start: fiscalStart, end: monthRange("current", now).end };
  }
  return { start: fiscalStart && fiscalStart > range.start ? fiscalStart : range.start, end: range.end };
}
export const transactionAmount = (t: CardTransaction) => Number(t.value) * (t.side === "INCOME" ? -1 : 1);
export const journalLabel = (status: string) => status === "none" ? "未" : "済";
export function cardSummaries(accounts: MfAccount[], transactions: CardTransaction[]) {
  return accounts.filter(a => a.kind === "card" && !a.hidden).map(account => {
    const rows = transactions.filter(t => t.mf_account_id === account.mf_account_id);
    return { account, amount: rows.reduce((sum,t) => sum + transactionAmount(t),0), count: rows.length, latest: rows.map(t => t.date).sort().at(-1) };
  });
}
/** 期間のプルダウンの「○○年度」の表記。年度の始まり（試算表の start_date）の年。無ければ 4 月始まりで今日から出す */
export function fiscalYearLabel(fiscalStart?: string | null, now = new Date()) {
  if (fiscalStart) return `${fiscalStart.slice(0, 4)}年度`;
  const jst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = jst.getUTCFullYear(), m = jst.getUTCMonth() + 1;
  return `${m >= 4 ? y : y - 1}年度`;
}
