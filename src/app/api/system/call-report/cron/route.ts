import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/cron-auth";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "@/app/system/_lib/call-metrics";
import { mergeCallMetrics, type RootEmployeeForCallMetrics } from "@/app/system/_lib/call-metrics-merge";
import { loadLpContext } from "@/app/system/_lib/lp-context.server";
import { buildCallReport } from "@/app/system/_lib/call-report";
import { shouldDeliverAt } from "@/app/system/_lib/call-report-schedule";
import { CallReportChatworkError } from "@/app/system/_lib/chatwork";
import { deliverCallReport } from "@/app/system/_lib/call-report-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = verifyCronRequest(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status });

  const now = new Date();
  const schedule = shouldDeliverAt(now);
  const base = { fired_at: schedule.firedAt, today_type: schedule.todayType, in_window: schedule.inWindow };
  if (!schedule.deliver) {
    console.info("[system/call-report/cron] completed", { ...base, skipped: true, reason: "out_of_window", sent: false, aggregateMs: 0, postMs: 0 });
    return NextResponse.json({ ok: true, ...base, skipped: true, reason: "out_of_window", sent: false, aggregateMs: 0, postMs: 0 });
  }

  const aggregateStarted = performance.now();
  const { data, error } = await getSupabaseAdmin().rpc("system_call_metrics", {
    p_from: schedule.date, p_to: schedule.date, p_list_name: null, p_employee_name: null,
  });
  const aggregateMs = Math.round(performance.now() - aggregateStarted);
  const rpcAuthorized = data && typeof data === "object" && "authorized" in data && data.authorized === true;
  if (error || !rpcAuthorized || "error" in data) {
    console.error("[system/call-report/cron] RPC failed", { ...base, aggregateMs });
    return NextResponse.json({ ok: false, ...base, error: "集計の取得に失敗しました", aggregateMs, postMs: 0 }, { status: 500 });
  }

  const filemaker = normalizeCallMetricsRpc(data, { from: schedule.date, to: schedule.date, listName: null, employeeName: null });
  const admin = getSupabaseAdmin();
  let rootEmployees: RootEmployeeForCallMetrics[] = [];
  try {
    const result = await admin.from("root_employees").select("employee_id,name,filemaker_employee_name,innovera_extension,innovera_mobile_extension,is_active,deleted_at");
    rootEmployees = Array.isArray(result.data) ? result.data : [];
  } catch {}
  const lpKintone = await loadLpContext({ client: admin, from: schedule.date, to: schedule.date, asOf: now, hasInnoveraRows: true });
  const innoveraResult = await admin.rpc("system_innovera_metrics", {
    p_from: schedule.date, p_to: schedule.date, p_lp_circuit_ids: lpKintone.lpCircuitIds, p_employee_id: null,
  });
  const metrics = {
    ...mergeCallMetrics({ filemaker, innovera: innoveraResult.error ? null : innoveraResult.data, lpScope: lpKintone.lpScope, lpApplicationCountsByBiz: lpKintone.lpApplicationCountsByBiz, lpRegisteredCountsByBiz: lpKintone.lpRegisteredCountsByBiz, lpCustomerOrderCountsByBiz: lpKintone.lpCustomerOrderCountsByBiz, rootEmployees, notes: lpKintone.notes }),
    lpFunnel: lpKintone.funnel,
    lpFormCount: lpKintone.formCount,
    lpUnmatchedOrders: lpKintone.lpUnmatchedOrders,
  };
  const summary = summarizeCallMetrics(metrics);
  const report = buildCallReport(summary, now, metrics);
  if (report.skipped) {
    console.info("[system/call-report/cron] completed", { ...base, skipped: true, reason: "no_calls", sent: false, aggregateMs, postMs: 0 });
    return NextResponse.json({ ok: true, ...base, skipped: true, reason: "no_calls", sent: false, aggregateMs, postMs: 0 });
  }

  const postStarted = performance.now();
  try {
    await deliverCallReport(report.text, metrics, now);
  } catch (error) {
    const postMs = Math.round(performance.now() - postStarted);
    const chatworkStatus = error instanceof CallReportChatworkError ? error.status : null;
    console.error("[system/call-report/cron] Chatwork failed", { ...base, aggregateMs, postMs, chatworkStatus });
    return NextResponse.json({ ok: false, ...base, error: "Chatwork送信に失敗しました", aggregateMs, postMs }, { status: 502 });
  }
  const postMs = Math.round(performance.now() - postStarted);
  console.info("[system/call-report/cron] completed", { ...base, skipped: false, sent: true, aggregateMs, postMs });
  return NextResponse.json({ ok: true, ...base, skipped: false, sent: true, aggregateMs, postMs });
}
