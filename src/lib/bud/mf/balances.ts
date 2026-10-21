import { accountAxes } from "./corporations";
import type { Arrival, ConnectedAccount, MfAccount, Transaction, TrialRow } from "./types";

export const accountKind = (name: string): "bank" | "card" => name.includes("カード") ? "card" : "bank";
export function bookBalances(rows: TrialRow[]): Map<string, number> {
  const result = new Map<string, number>();
  function visit(items: TrialRow[], deposits = false) {
    for (const row of items) {
      const underDeposits = row.type === "account" ? row.name === "普通預金" : deposits;
      if (underDeposits && row.type === "sub_account" && row.name) {
        const value = Number(row.values?.[3]);
        if (row.values?.[3] == null || !Number.isFinite(value) || result.has(row.name)) throw new Error("帳簿の補助科目を確認してください");
        result.set(row.name, value);
      }
      visit(row.rows ?? row.children ?? [], underDeposits);
    }
  }
  visit(rows);
  return result;
}
export function calculateBalance(account: Pick<MfAccount, "mf_account_id" | "book_sub_account_name" | "balance_mode" | "anchor_balance" | "anchor_date" | "anchor_at">, books: Map<string, number>, transactions: Transaction[], today = monthRange("current").end, pendingSince?: string, arrivals: Arrival[] = []) {
  const pending = transactions.filter(t => String(t.connected_account_id) === account.mf_account_id && t.journalizing_status === "none" && (!pendingSince || t.date >= pendingSince) && t.date <= today);
  if (account.balance_mode === "manual_check") return { balance: null, unjournalized_count: pending.length };
  if (account.balance_mode === "arrival") {
    const balance = account.anchor_balance == null || !account.anchor_at ? null : arrivals
      .filter(t => t.mf_account_id === account.mf_account_id && Date.parse(t.first_seen_at) > Date.parse(account.anchor_at!))
      .reduce((sum, t) => sum + (t.side === "INCOME" ? Number(t.value) : -Number(t.value)), Number(account.anchor_balance));
    return { balance, unjournalized_count: pending.length };
  }
  if (account.balance_mode === "anchor") {
    if (account.anchor_balance == null || !account.anchor_date) return { balance: null, unjournalized_count: pending.length };
    const balance = transactions.filter(t => String(t.connected_account_id) === account.mf_account_id && t.date > account.anchor_date! && t.date <= today)
      .reduce((sum, t) => sum + (t.side === "INCOME" ? t.value : -t.value), Number(account.anchor_balance));
    return { balance, unjournalized_count: pending.length };
  }
  const book = account.book_sub_account_name ? books.get(account.book_sub_account_name) : 0;
  if (book === undefined) throw new Error("帳簿の補助科目が見つかりません");
  return { balance: pending.reduce((sum, t) => sum + (t.side === "INCOME" ? t.value : -t.value), book), unjournalized_count: pending.length };
}
export function mergeAccounts(incoming: ConnectedAccount[], existing: MfAccount[], viewers: string[], fetchedAt: string): MfAccount[] {
  let next = Math.max(-1, ...existing.map(a => a.sort_order)) + 1;
  return incoming.map(item => {
    const old = existing.find(a => a.mf_account_id === String(item.id));
    return { ...accountAxes(item.name), mf_account_id: String(item.id), name: item.name, kind: accountKind(item.name),
      sub_account_label: (item.connected_sub_accounts ?? []).map(a => a.name).join(" ／ "),
      sort_order: old?.sort_order ?? next++, hidden: old?.hidden ?? false,
      visible_employee_ids: old?.visible_employee_ids ?? viewers, book_sub_account_name: old?.book_sub_account_name ?? "",
      anchor_balance: old?.anchor_balance ?? null, anchor_date: old?.anchor_date ?? null, anchor_at: old?.anchor_at ?? null,
      balance_mode: old?.balance_mode ?? "manual_check", balance_note: old?.balance_note ?? "帳簿との対応を確認中です",
      balance: null, unjournalized_count: 0, fetched_at: fetchedAt };
  });
}
export const visibleAccounts = (accounts: MfAccount[], employeeId: string, admin: boolean) => accounts.filter(a => admin || (!a.hidden && a.visible_employee_ids.includes(employeeId))).sort((a,b) => a.sort_order - b.sort_order || a.mf_account_id.localeCompare(b.mf_account_id));
export function monthRange(period: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const [y,m] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - (period === "last" ? 2 : period === "three" ? 3 : 1), 1)).toISOString().slice(0,10);
  const end = period === "last" ? new Date(Date.UTC(y,m-1,0)).toISOString().slice(0,10) : today;
  return { start, end };
}

export function arrivalTotals(arrivals: Arrival[], accountIds: string[]) {
  const ids = new Set(accountIds);
  const income = arrivals.filter(t => ids.has(t.mf_account_id) && t.side === "INCOME").reduce((s,t) => s + Number(t.value), 0);
  const expense = arrivals.filter(t => ids.has(t.mf_account_id) && t.side === "EXPENSE").reduce((s,t) => s + Number(t.value), 0);
  return { income, expense, delta: income - expense };
}
