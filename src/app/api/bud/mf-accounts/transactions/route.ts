import { NextResponse } from "next/server";
import { mfAccess } from "@/lib/bud/mf/access";
import { transactionAmount, transactionRange } from "@/lib/bud/mf/transactions";
import type { CardTransaction } from "@/lib/bud/mf/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const auth = await mfAccess();
  if (!auth.ok) return NextResponse.json({ error: "この画面を見る権限がありません" }, { status: auth.status });
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  const period = params.get("period") ?? "current";
  const page = Number(params.get("page") ?? "1");
  if (!id || !["current","last","year"].includes(period) || !Number.isSafeInteger(page) || page < 1 || page > 1000000) return NextResponse.json({ error: "表示条件を確認してください" }, { status: 400 });
  const fail = () => NextResponse.json({ error: "明細を読み込めませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
  // Use the signed-in session for both account lookup and rows: RLS applies even to a direct URL.
  const result = await auth.db.from("bud_mf_accounts").select("*").eq("mf_account_id",id).maybeSingle();
  if (result.error) return fail();
  if (!result.data || result.data.hidden || (!auth.admin && !result.data.visible_employee_ids.includes(auth.employeeId))) return NextResponse.json({ error: "この口座・カードは表示できません" }, { status: 404 });
  const account = result.data;
  let range;
  try { range = transactionRange(period, account.fiscal_start_date); }
  catch { return NextResponse.json({ error: "今年度の取引を読み直してください" }, { status: 409 }); }
  const query = auth.db.from(account.kind === "card" ? "bud_mf_card_transactions" : "bud_mf_bank_transactions").select("*").eq("mf_account_id",id).gte("date",range.start).lte("date",range.end).order("date",{ ascending:false }).order("mf_transaction_id");
  const rows: CardTransaction[] = [];
  for (let offset = 0; ; offset += 1000) {
    const batch = await query.range(offset,offset+999);
    if (batch.error) return fail();
    rows.push(...batch.data);
    if (batch.data.length < 1000) break;
  }
  return NextResponse.json({ account, transactions: rows.slice((page-1)*100,page*100), total: rows.length, amount: rows.reduce((sum,t) => sum + transactionAmount(t),0),
    income: rows.reduce((sum,t) => sum + (t.side === "INCOME" ? Number(t.value) : 0),0), expense: rows.reduce((sum,t) => sum + (t.side === "EXPENSE" ? Number(t.value) : 0),0), page, range }, { headers: { "Cache-Control":"no-store" } });
}
