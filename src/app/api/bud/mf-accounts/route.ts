import { NextResponse } from "next/server";
import { mfAccess } from "@/lib/bud/mf/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { monthRange } from "@/lib/bud/mf/balances";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const fail = () => NextResponse.json({ error: "口座を読み込めませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
export async function GET(request: Request) {
  const auth = await mfAccess();
  if (!auth.ok) return NextResponse.json({ error: "この画面を見る権限がありません" }, { status: auth.status });
  const accounts = await auth.db.from("bud_mf_accounts").select("*").order("sort_order").order("mf_account_id");
  if (accounts.error) return fail();
  const params = new URL(request.url).searchParams;
  const range = monthRange(params.get("period") ?? "current");
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
  let employees: { employee_id: string; name: string | null }[] = [];
  if (auth.admin) {
    const result = await getSupabaseAdmin().from("root_employees").select("employee_id,name").is("deleted_at",null).order("name");
    if (result.error) return fail();
    employees = result.data;
  }
  const axes = await auth.db.from("bud_mf_axis_order").select("*").order("sort_order");
 const snapshots = await auth.db.from("bud_mf_balance_snapshots").select("*").eq("snapshot_date", monthRange("current").end);
 if (axes.error || snapshots.error) return fail();
 return NextResponse.json({ accounts: accounts.data, transactions, employees, admin: auth.admin, axes: axes.data, snapshots: snapshots.data }, { headers: { "Cache-Control": "no-store" } });
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
      if (typeof body.id !== "string" || typeof body.hidden !== "boolean" || typeof body.book !== "string" || body.book.length > 500 || typeof body.note !== "string" || body.note.length > 1000 || !["auto","manual_check"].includes(body.mode) || !Array.isArray(body.viewers) || body.viewers.length > 2000 || !body.viewers.every((id: unknown) => typeof id === "string")) throw new Error();
      result = await auth.db.rpc("bud_mf_save_settings", { p_id: body.id, p_viewers: [...new Set(body.viewers)], p_hidden: body.hidden, p_book: body.book.trim(), p_mode: body.mode, p_note: body.note.trim() });
    } else throw new Error();
    if (result.error) return NextResponse.json({ error: "保存できませんでした。読み込み中の場合は終了後にもう一度お試しください。" }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "設定内容を確認してください" }, { status: 400 }); }
}
