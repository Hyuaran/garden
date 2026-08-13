import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/cron-auth";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "@/app/system/_lib/call-metrics";
import { buildCallReport } from "@/app/system/_lib/call-report";
import { shouldDeliverAt } from "@/app/system/_lib/call-report-schedule";
import { CallReportChatworkError, sendCallReportMessage } from "@/app/system/_lib/chatwork";

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

  const metrics = normalizeCallMetricsRpc(data, { from: schedule.date, to: schedule.date, listName: null, employeeName: null });
  const summary = summarizeCallMetrics(metrics);
  const report = buildCallReport(summary, now);
  if (report.skipped) {
    console.info("[system/call-report/cron] completed", { ...base, skipped: true, reason: "no_calls", sent: false, aggregateMs, postMs: 0 });
    return NextResponse.json({ ok: true, ...base, skipped: true, reason: "no_calls", sent: false, aggregateMs, postMs: 0 });
  }

  const postStarted = performance.now();
  try {
    await sendCallReportMessage(report.text);
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
