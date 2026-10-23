import { NextResponse } from "next/server";
import { broadbandAccess } from "@/lib/bud/broadband/access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const forbidden = () => NextResponse.json({ error: "設定を変更する権限がありません" }, { status: 403 });
export async function GET() {
  const auth = await broadbandAccess();
  if (!auth.ok || !auth.admin) return forbidden();
  const viewers = await auth.db.from("bud_bb_viewers").select("employee_ids").eq("id", 1).single();
  const employees = await getSupabaseAdmin().from("root_employees").select("employee_id,name,name_kana").eq("is_active", true).is("deleted_at", null).or(`termination_date.is.null,termination_date.gt.${new Date(Date.now() + 9 * 3600000).toISOString().slice(0,10)}`).order("name");
  if (viewers.error || employees.error) return NextResponse.json({ error: "閲覧権限を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ viewers: viewers.data.employee_ids, employees: employees.data }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  const auth = await broadbandAccess();
  if (!auth.ok || !auth.admin) return forbidden();
  let viewers: string[];
  try {
    const body = await request.json();
    if (!body || !Array.isArray(body.viewers) || body.viewers.length > 2000 || !body.viewers.every((v: unknown) => typeof v === "string" && v.length <= 100)) throw new Error();
    viewers = [...new Set<string>(body.viewers)];
  } catch { return NextResponse.json({ error: "設定内容を確認してください" }, { status: 400 }); }
  const result = await auth.db.rpc("bud_bb_save_viewers", { p_viewers: viewers });
  if (result.error) return NextResponse.json({ error: "保存できませんでした。閲覧者を確認してもう一度お試しください。" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
