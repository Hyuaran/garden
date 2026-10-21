import type { SupabaseClient } from "@supabase/supabase-js";
import { ChatworkClient } from "@/lib/chatwork";
import { MfClient } from "./client";
import { automaticAnchor, bookBalances, calculateBalance, mergeAccounts, monthRange } from "./balances";
import type { BookSubAccount, MfAccount, Transaction } from "./types";

export async function syncMf(db: SupabaseClient, trigger: "cron" | "button", options: { now?: Date; client?: MfClient; key?: string; viewers?: string; snapshot?: boolean; notify?: (message: string) => Promise<void> } = {}) {
  const begin = await db.rpc("bud_mf_begin_fetch", { p_trigger: trigger });
  if (begin.error) throw new Error("読み込みを開始できませんでした");
  if (!begin.data) return { ok: false, busy: true, error: "読み込み中、または前回の読み込みから1分以内です" };
  const runId = begin.data as string;
  try {
    const key = options.key ?? process.env.MF_ACCOUNTING_API_KEY;
    if (!key) throw new Error("読み込みの設定を確認してください");
    const client = options.client ?? new MfClient(key);
    const now = options.now ?? new Date();
    const fetchedAt = now.toISOString();
    const range = monthRange("current", now);
    const saved = await db.from("bud_mf_accounts").select("*");
    if (saved.error) throw new Error("前回の口座を読み込めませんでした");
    const incoming = await client.accounts();
    const existing = saved.data as MfAccount[];
    const savedFiscalStart = existing.find(a => a.fiscal_start_date)?.fiscal_start_date;
    const fiscalAnniversary = savedFiscalStart ? range.end.slice(0,4) + savedFiscalStart.slice(4) : null;
    const fiscalStart = fiscalAnniversary && (fiscalAnniversary <= range.end
      ? fiscalAnniversary : String(Number(range.end.slice(0,4)) - 1) + savedFiscalStart!.slice(4));
    const newBanks = incoming.filter(i => !i.name.includes("カード") && !existing.some(a => a.mf_account_id === String(i.id)));
    let trial: { start_date: string; rows: import("./types").TrialRow[] } = { start_date: fiscalStart || range.start, rows: [] };
    let trialReadable = false;
    if (!fiscalStart || existing.some(a => a.balance_mode === "auto") || newBanks.length) {
      try { trial = await client.trialBalance(); trialReadable = true; }
      catch { /* New accounts remain manual when the trial balance is unavailable. */ }
    }
    const start = [trial.start_date, ...existing.filter(a => a.balance_mode === "anchor" && a.anchor_balance != null && a.anchor_date).map(a => a.anchor_date!)].sort()[0];
    const transactions = await client.transactions(start, range.end);
    let books = new Map<string, number>();
    try { books = bookBalances(trial.rows); } catch { trialReadable = false; }
    let subAccounts: BookSubAccount[] = [];
    if (trialReadable && newBanks.some(i => !automaticAnchor(i, trial.rows))) {
      try { subAccounts = await client.subAccounts(); } catch { /* Leave unresolved mappings for manual confirmation. */ }
    }
    const failed: MfAccount[] = [];
    const accounts = mergeAccounts(incoming, existing, [], fetchedAt).map(a => {
      if (a.kind !== "bank") return a;
      const item = newBanks.find(i => String(i.id) === a.mf_account_id);
      if (item) {
        const name = trialReadable ? automaticAnchor(item, trial.rows, subAccounts) : null;
        if (name && books.has(name)) {
          const calculated = calculateBalance({ ...a, balance_mode: "auto", book_sub_account_name: name }, books, transactions, range.end, trial.start_date);
          a = { ...a, book_sub_account_name: name, balance_mode: "arrival", anchor_balance: calculated.balance, anchor_at: fetchedAt, anchor_date: range.end, balance_note: `起点を自動で設定（帳簿＋未仕訳・${range.end.replaceAll("-", "/")}）` };
        } else failed.push(a);
      }
      if (a.balance_mode === "auto" && !trialReadable) return { ...a, balance: existing.find(old => old.mf_account_id === a.mf_account_id)?.balance ?? null, unjournalized_count: calculateBalance({ ...a, balance_mode: "manual_check" }, books, transactions, range.end, trial.start_date).unjournalized_count };
      return { ...a, ...calculateBalance(a, books, transactions, range.end, trial.start_date) };
    });
    accounts.forEach(a => { a.fiscal_start_date = trialReadable || fiscalStart ? trial.start_date : null; });
    const { card, bank } = storedTransactions(accounts, transactions, fetchedAt);
    // The RPC records first observations and recalculates arrival balances under the
    // settings lock, using the database timestamp and immutable stored amounts.
    const applied = await db.rpc("bud_mf_apply_fetch", { p_run_id: runId, p_accounts: accounts, p_transactions: card, p_bank_transactions: bank, p_since: trial.start_date, p_until: range.end, ...(options.snapshot ? { p_snapshot_date: range.end } : {}) });
    if (applied.error) { console.error("[bud-mf] apply failed", applied.error.message); throw new Error("読み込み結果を保存できませんでした"); }
    for (const account of failed) {
      const message = `口座残高：新しい口座『${account.name.replaceAll("[", "［").replaceAll("]", "］")}』の最初の残高を自動で入れられませんでした。設定から入れてください`;
      try {
        if (options.notify) await options.notify(message);
        else {
          const token = process.env.CHATWORK_API_TOKEN;
          const room = process.env.GARDEN_NOTICE_CHATWORK_ROOM_ID;
          if (!token || !room) throw new Error("通知設定がありません");
          await new ChatworkClient(token).sendMessage(room, message);
        }
      } catch { console.error("[bud-mf] new account notice failed"); }
    }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "読み込めませんでした";
    const recorded = await db.from("bud_mf_fetch_runs").update({ ok: false, error: message }).eq("id", runId);
    if (recorded.error) console.error("MF failure record could not be saved");
    return { ok: false, error: message };
  }
}

export function storedTransactions(accounts: MfAccount[], transactions: Transaction[], fetchedAt: string) {
    const cards = new Set(accounts.filter(a => a.kind === "card").map(a => a.mf_account_id));
    const banks = new Set(accounts.filter(a => a.kind === "bank").map(a => a.mf_account_id));
    const stored = transactions.map(t => ({
      mf_transaction_id: String(t.id), mf_account_id: String(t.connected_account_id), date: t.date, content: t.content,
      value: t.value, side: t.side, journalizing_status: t.journalizing_status, fetched_at: fetchedAt,
    }));
    return { card: stored.filter(t => cards.has(t.mf_account_id)), bank: stored.filter(t => banks.has(t.mf_account_id)) };
}
