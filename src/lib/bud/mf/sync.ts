import type { SupabaseClient } from "@supabase/supabase-js";
import { MfClient } from "./client";
import { bookBalances, calculateBalance, mergeAccounts, monthRange } from "./balances";
import type { MfAccount } from "./types";

export async function syncMf(db: SupabaseClient, trigger: "cron" | "button", options: { now?: Date; client?: MfClient; key?: string; viewers?: string; snapshot?: boolean } = {}) {
  const begin = await db.rpc("bud_mf_begin_fetch", { p_trigger: trigger });
  if (begin.error) throw new Error("読み込みを開始できませんでした");
  if (!begin.data) return { ok: false, busy: true, error: "読み込み中、または前回の読み込みから1分以内です" };
  const runId = begin.data as string;
  try {
    const key = options.key ?? process.env.MF_ACCOUNTING_API_KEY;
    const viewers = (options.viewers ?? process.env.BUD_MF_DEFAULT_VIEWERS ?? "EMP-0000,EMP-0004,EMP-0008").split(",").map(v => v.trim()).filter(Boolean);
    if (!key || !viewers.length) throw new Error("読み込みの設定を確認してください");
    const client = options.client ?? new MfClient(key);
    const now = options.now ?? new Date();
    const fetchedAt = now.toISOString();
    const range = monthRange("three", now);
    const saved = await db.from("bud_mf_accounts").select("*");
    if (saved.error) throw new Error("前回の口座を読み込めませんでした");
    const incoming = await client.accounts();
    const trial = await client.trialBalance();
    const start = [trial.start_date, range.start, ...(saved.data as MfAccount[]).filter(a => a.balance_mode === "anchor" && a.anchor_balance != null && a.anchor_date).map(a => a.anchor_date!)].sort()[0];
    const transactions = await client.transactions(start, range.end);
    const books = bookBalances(trial.rows);
    const accounts = mergeAccounts(incoming, saved.data as MfAccount[], viewers, fetchedAt).map(a => a.kind === "bank"
      ? { ...a, ...calculateBalance(a, books, a.balance_mode === "anchor" ? transactions : transactions.filter(t => t.date >= trial.start_date && t.date <= range.end), range.end, trial.start_date) } : a);
    const cards = new Set(accounts.filter(a => a.kind === "card").map(a => a.mf_account_id));
    const cardTransactions = transactions.filter(t => cards.has(String(t.connected_account_id)) && t.date >= range.start && t.date <= range.end).map(t => ({
      mf_transaction_id: String(t.id), mf_account_id: String(t.connected_account_id), date: t.date, content: t.content,
      value: t.value, side: t.side, journalizing_status: t.journalizing_status, fetched_at: fetchedAt,
    }));
    const applied = await db.rpc("bud_mf_apply_fetch", { p_run_id: runId, p_accounts: accounts, p_transactions: cardTransactions, p_since: range.start, ...(options.snapshot ? { p_snapshot_date: monthRange("current", new Date()).end } : {}) });
    if (applied.error) { console.error("[bud-mf] apply failed", applied.error.message); throw new Error("読み込み結果を保存できませんでした"); }
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "読み込めませんでした";
    const recorded = await db.from("bud_mf_fetch_runs").update({ ok: false, error: message }).eq("id", runId);
    if (recorded.error) console.error("MF failure record could not be saved");
    return { ok: false, error: message };
  }
}
