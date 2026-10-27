import { verifyBearerRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendGardenNotice } from "@/lib/relay/monitor.server";
import { billingPeriod, fetchBillingCharges, judgeUsage, usageNotice, type Alert } from "@/lib/vercel-usage";

export const runtime = "nodejs";
// Once daily: 1 billing request, up to 31 daily rows per service; scheduling remains disabled.
export async function GET(request: Request) {
  const auth = verifyBearerRequest(request, "CRON_SECRET");
  if (!auth.ok) return Response.json({ ok: false, error: auth.reason }, { status: auth.status });
  if (!process.env.VERCEL_BILLING_TOKEN) return Response.json({ ok: true, skipped: "no_token" });
  try {
    const now = new Date(), { start, today } = billingPeriod(now);
    // Include seven baseline days before yesterday, even across the billing boundary.
    const from = new Date(Math.min(start.getTime(), today.getTime() - 8 * 86400000));
    const { rows } = await fetchBillingCharges(from, today);
    const db = getSupabaseAdmin();
    if (rows.length) {
      const { error } = await db.from("system_vercel_usage_daily").upsert(rows.map(r=>({...r,fetched_at:now.toISOString()})), { onConflict: "day,service" });
      if (error) throw error;
    }
    const { data: previous, error } = await db.from("system_vercel_usage_alerts").select("*");
    if (error) throw error;
    const included = Number(process.env.VERCEL_INCLUDED_USAGE_USD ?? 20);
    if (!Number.isFinite(included) || included < 0) throw new Error("Invalid included usage");
    const result = judgeUsage(rows, (previous ?? []) as Alert[], now, included);
    // ?dry=1：計算だけして知らせも記録もしない（初回の確かめ用）
    if (new URL(request.url).searchParams.get("dry") === "1") {
      return Response.json({ ok: true, dry: true, rows: rows.length, spent: result.spent, projected: result.projected, notices: result.changes.map(c => c.key) });
    }
    // 「超えました」と「超える見込み」が同時に立つときは、知らせは「超えました」の 1 通だけ（記録は両方）
    const spentOverNow = result.changes.some(c => c.key === "spent_over" && c.active);
    for (const change of result.changes) {
      const quiet = spentOverNow && change.key === "projected_over" && change.active;
      if (!quiet && !await sendGardenNotice(usageNotice(result, change, now))) throw new Error("Notice unavailable");
      const { error: saveError } = await db.from("system_vercel_usage_alerts").upsert(change);
      if (saveError) throw saveError;
    }
    return Response.json({ ok: true, rows: rows.length, notices: result.changes.length });
  } catch {
    return Response.json({ ok: false, error: "料金の確認を完了できませんでした" }, { status: 500 });
  }
}
