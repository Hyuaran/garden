import { NextResponse } from "next/server";
import { mfAccess } from "@/lib/bud/mf/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Arrival } from "@/lib/bud/mf/types";
import { arrivalTotals, monthRange } from "@/lib/bud/mf/balances";
import { transactionRange, transactionYears, validTransactionPeriod } from "@/lib/bud/mf/transactions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = () => NextResponse.json({ error: "口座を読み込めませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
export async function GET(request: Request) {
  const auth = await mfAccess();
  if (!auth.ok) return NextResponse.json({ error: "この画面を見る権限がありません" }, { status: auth.status });
  const accounts = await auth.db.from("bud_mf_accounts").select("*").order("sort_order").order("mf_account_id");
  if (accounts.error) return fail();
  const params = new URL(request.url).searchParams;
  if (!validTransactionPeriod(params.get("period") ?? "current")) return NextResponse.json({ error: "表示条件を確認してください" }, { status: 400 });
  let range;
  try { range = transactionRange(params.get("period") ?? "current", accounts.data.find(a => a.fiscal_start_date)?.fiscal_start_date); }
  catch { return NextResponse.json({ error: "今年度の取引を読み直してください" }, { status: 409 }); }
  let query = auth.db.from("bud_mf_card_transactions").select("*").gte("date",range.start).lte("date",range.end).order("date", { ascending: false }).order("mf_transaction_id");
  if (params.get("card")) query = query.eq("mf_account_id", params.get("card"));
  // Paginate the stored snapshot too: Supabase caps a single response at 1,000 rows.
  const transactions = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await query.range(offset,offset+999);
    if (page.error) return fail();
    transactions.push(...page.data);
    if (page.data.length < 1000) break;
  }
  const yearsByAccount: Record<string, number[]> = {};
  const dates: { mf_account_id: string; date: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = await auth.db.from("bud_mf_card_transactions").select("mf_account_id,date").order("mf_transaction_id").range(offset,offset+999);
    if (batch.error) return fail();
    dates.push(...batch.data);
    if (batch.data.length < 1000) break;
  }
  for (const account of accounts.data.filter(a => a.kind === "card" && !a.hidden)) yearsByAccount[account.mf_account_id] = transactionYears(dates.filter(t => t.mf_account_id === account.mf_account_id));
  let employees: { employee_id: string; name: string | null }[] = [];
  if (auth.admin) {
    const result = await getSupabaseAdmin().from("root_employees").select("employee_id,name").is("deleted_at",null).order("name");
    if (result.error) return fail();
    employees = result.data;
  }
  const axes = await auth.db.from("bud_mf_axis_order").select("*").order("sort_order");
 const snapshots = await auth.db.from("bud_mf_balance_snapshots").select("*").eq("snapshot_date", monthRange("current").end);
 if (axes.error || snapshots.error) return fail();
 const arrivals: Arrival[] = [];
 const midnight = new Date(monthRange("current").end + "T00:00:00+09:00").toISOString();
 for (let offset = 0; ; offset += 1000) {
   const page = await auth.db.from("bud_mf_bank_tx_seen").select("*").gt("first_seen_at", midnight).order("mf_transaction_id").range(offset, offset + 999);
   if (page.error) return fail();
   arrivals.push(...page.data);
   if (page.data.length < 1000) break;
 }
 const visibleBanks = accounts.data.filter(a => a.kind === "bank" && !a.hidden);
 const arrivalByAccount = Object.fromEntries(visibleBanks.map(a => [a.mf_account_id, arrivalTotals(arrivals, [a.mf_account_id])]));
 return NextResponse.json({ yearsByAccount, arrivalByAccount, arrivalTotal: arrivalTotals(arrivals, visibleBanks.map(a => a.mf_account_id)), accounts: accounts.data, transactions, employees, admin: auth.admin, axes: axes.data, snapshots: snapshots.data }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  const auth = await mfAccess();
  if (!auth.ok || !auth.admin) return NextResponse.json({ error: "設定を変更する権限がありません" }, { status: 403 });
  try {
    const body = await request.json();
    let result;
    if (body.action === "axis-order") {
 if (!["corp", "bank"].includes(body.axis) || !Array.isArray(body.keys) || body.keys.length > 2000 || !body.keys.every((k: unknown) => typeof k === "string") || new Set(body.keys).size !== body.keys.length) throw new Error();
 result = await auth.db.rpc("bud_mf_reorder_axis", { p_axis: body.axis, p_keys: body.keys });
 } else if (body.action === "reorder") {
      if (!Array.isArray(body.ids) || !body.ids.every((id: unknown) => typeof id === "string") || body.ids.length > 2000) throw new Error();
      result = await auth.db.rpc("bud_mf_reorder", { p_ids: body.ids });
    } else if (body.action === "settings") {
      if (typeof body.id !== "string" || typeof body.hidden !== "boolean" || typeof body.book !== "string" || body.book.length > 500 || typeof body.note !== "string" || body.note.length > 1000 || !["auto","manual_check","anchor","arrival"].includes(body.mode) || !Array.isArray(body.viewers) || body.viewers.length > 2000 || !body.viewers.every((id: unknown) => typeof id === "string")) throw new Error();
      const anchorBalance = body.anchor_balance ?? null;
      const anchorDate = body.anchor_date ?? null;
      if (anchorBalance !== null && (typeof anchorBalance !== "number" || !Number.isSafeInteger(anchorBalance))) throw new Error();
      if (anchorDate !== null && (typeof anchorDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(anchorDate) || !Number.isFinite(Date.parse(anchorDate)) || new Date(anchorDate).toISOString().slice(0,10) !== anchorDate)) throw new Error();
      const anchorAt = body.anchor_at ?? null;
      if (anchorAt !== null && (typeof anchorAt !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/.test(anchorAt) || !Number.isFinite(Date.parse(anchorAt)))) throw new Error();
      if (body.mode === "arrival" && (anchorBalance === null || anchorAt === null)) throw new Error();
      result = await auth.db.rpc("bud_mf_save_settings", { p_id: body.id, p_viewers: [...new Set(body.viewers)], p_hidden: body.hidden, p_book: body.book.trim(), p_mode: body.mode, p_note: body.note.trim(), p_anchor_balance: anchorBalance, p_anchor_date: anchorDate, ...(body.mode === "arrival" || body.anchor_at !== undefined ? { p_anchor_at: anchorAt } : {}) });
    } else throw new Error();
    if (result.error) return NextResponse.json({ error: "保存できませんでした。読み込み中の場合は終了後にもう一度お試しください。" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "設定内容を確認してください" }, { status: 400 }); }
}
