import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "@/app/system/_lib/call-metrics";
import { buildCallReport, parseReportDate } from "@/app/system/_lib/call-report";
import { CallReportChatworkError, sendCallReportMessage } from "@/app/system/_lib/chatwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_ROLES = new Set(["manager", "admin", "super_admin"]);

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });

  const { data: employee, error: roleError } = await supabase
    .from("root_employees").select("garden_role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (roleError) return NextResponse.json({ ok: false, error: "権限確認に失敗しました" }, { status: 500 });
  if (!employee || !VIEW_ROLES.has(String(employee.garden_role))) {
    return NextResponse.json({ ok: false, error: "閲覧権限がありません" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "JSON本文が不正です" }, { status: 400 }); }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "リクエストが不正です" }, { status: 400 });
  }
  const input = body as { mode?: unknown; date?: unknown };
  if (input.mode !== "preview" && input.mode !== "send") {
    return NextResponse.json({ ok: false, error: "modeはpreviewまたはsendを指定してください" }, { status: 400 });
  }
  let date: string;
  try { date = parseReportDate(input.date); }
  catch (error) { return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 }); }

  const aggregateStarted = performance.now();
  const { data, error } = await supabase.rpc("system_call_metrics", {
    p_from: date, p_to: date, p_list_name: null, p_employee_name: null,
  });
  const aggregateMs = Math.round(performance.now() - aggregateStarted);
  if (error) {
    console.error("[system/call-report] RPC failed", { code: error.code, aggregateMs });
    return NextResponse.json({ ok: false, error: "集計の取得に失敗しました" }, { status: 500 });
  }

  const metrics = normalizeCallMetricsRpc(data, { from: date, to: date, listName: null, employeeName: null });
  const summary = summarizeCallMetrics(metrics);
  const report = buildCallReport(summary);
  if (report.skipped) {
    console.info("[system/call-report] completed", { mode: input.mode, date, skipped: true, aggregateMs, postMs: 0 });
    return NextResponse.json(input.mode === "preview"
      ? { ok: true, skipped: true, reason: report.reason, text: null, summary, aggregateMs }
      : { ok: true, skipped: true, reason: report.reason, sent: false, elapsedMs: { aggregate: aggregateMs, post: 0 } });
  }

  if (input.mode === "preview") {
    console.info("[system/call-report] completed", { mode: input.mode, date, skipped: false, aggregateMs, postMs: 0 });
    return NextResponse.json({ ok: true, skipped: false, text: report.text, summary, aggregateMs });
  }

  const postStarted = performance.now();
  try {
    await sendCallReportMessage(report.text);
  } catch (error) {
    const postMs = Math.round(performance.now() - postStarted);
    const chatworkStatus = error instanceof CallReportChatworkError ? error.status : null;
    console.error("[system/call-report] Chatwork failed", { date, aggregateMs, postMs, chatworkStatus });
    return NextResponse.json({ ok: false, error: "Chatwork送信に失敗しました", elapsedMs: { aggregate: aggregateMs, post: postMs } }, { status: 502 });
  }
  const postMs = Math.round(performance.now() - postStarted);
  console.info("[system/call-report] completed", { mode: input.mode, date, skipped: false, aggregateMs, postMs });
  return NextResponse.json({ ok: true, skipped: false, sent: true, elapsedMs: { aggregate: aggregateMs, post: postMs } });
}
