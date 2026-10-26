import { budViewContext, budViewResponse } from "@/lib/auth/bud-view.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const denied = await budViewResponse("bud-expenses", "done");
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "集計条件を確認してください。" }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "集計条件を確認してください。" }, { status: 400 });
  for (const key of ["p_start", "p_end"]) if (body[key] != null && !/^\d{4}-\d{2}-\d{2}$/.test(body[key])) return Response.json({ error: "日付を確認してください。" }, { status: 400 });
  if (body.p_booking_corp_id != null && (typeof body.p_booking_corp_id !== "string" || body.p_booking_corp_id.length > 100)) return Response.json({ error: "法人を確認してください。" }, { status: 400 });
  const context = await budViewContext();
  const result = await (context.defaultAllowed ? context.db : getSupabaseAdmin()).rpc("bud_expense_done_summary", { p_booking_corp_id: body.p_booking_corp_id ?? null, p_start: body.p_start ?? null, p_end: body.p_end ?? null });
  return Response.json(result.error ? { error: "集計できませんでした。" } : { data: result.data }, { status: result.error ? 500 : 200, headers: { "Cache-Control": "private, no-store" } });
}
