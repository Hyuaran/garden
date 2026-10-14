import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { normalizeCallMetricsRpc, summarizeCallMetrics } from "@/app/system/_lib/call-metrics";
import { mergeCallMetrics, type RootEmployeeForCallMetrics } from "@/app/system/_lib/call-metrics-merge";
import { countLpApplications, loadLpCustomerRecords, loadLpScope, lpCustomerAppTokenEnv } from "@/app/system/_lib/lp-kintone";
import { buildCallReport, parseReportDate } from "@/app/system/_lib/call-report";
import { CallReportChatworkError } from "@/app/system/_lib/chatwork";
import { deliverCallReport } from "@/app/system/_lib/call-report-delivery";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import type { GardenRole } from "@/app/root/_constants/types";
import { MANAGER_VIEW_ROLES } from "@/lib/auth/view-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_ROLES = MANAGER_VIEW_ROLES;

async function loadRootEmployees(supabase: Awaited<ReturnType<typeof createServerClient>>): Promise<RootEmployeeForCallMetrics[]> {
  try {
    const result = await supabase
      .from("root_employees")
      .select("employee_id,name,filemaker_employee_name,innovera_extension,innovera_mobile_extension,is_active,deleted_at");
    const rows = "data" in result ? result.data : null;
    return Array.isArray(rows) ? rows as RootEmployeeForCallMetrics[] : [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });

  const { data: employee, error: roleError } = await supabase
    .from("root_employees").select("garden_role,is_active,termination_date,deleted_at").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (roleError) return NextResponse.json({ ok: false, error: "権限確認に失敗しました" }, { status: 500 });
  if (!employee || !isEmployeeActive(employee) || !VIEW_ROLES.has(String(employee.garden_role) as GardenRole)) {
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

  const filemaker = normalizeCallMetricsRpc(data, { from: date, to: date, listName: null, employeeName: null });
  const rootEmployees = await loadRootEmployees(supabase);
  const lpScope = await loadLpScope().catch(() => null);
  const lpCircuitIds = [...new Set((lpScope ?? []).flatMap((biz) => biz.circuitIds))];
  const innoveraResult = await supabase.rpc("system_innovera_metrics", {
    p_from: date, p_to: date, p_lp_circuit_ids: lpCircuitIds, p_employee_id: null,
  });
  const notes: string[] = [];
  const lpApplicationCountsByBiz = new Map<string, Map<string, number> | null>();
  if (!lpScope) {
    notes.push("LP申込み（kintone）の事業マスタを取得できませんでした");
  } else {
    const recordsByApp = new Map<number, Awaited<ReturnType<typeof loadLpCustomerRecords>>>();
    for (const biz of lpScope) {
      if (!lpCustomerAppTokenEnv(biz.customerApp)) {
        lpApplicationCountsByBiz.set(biz.bizCode, null);
        notes.push(`LP申込み（kintone）の鍵が未設定：アプリ ${biz.customerApp}`);
        continue;
      }
      if (!recordsByApp.has(biz.customerApp)) recordsByApp.set(biz.customerApp, await loadLpCustomerRecords(biz.customerApp));
      lpApplicationCountsByBiz.set(biz.bizCode, countLpApplications(recordsByApp.get(biz.customerApp) ?? null, date, date));
    }
  }
  const metrics = mergeCallMetrics({ filemaker, innovera: innoveraResult.error ? null : innoveraResult.data, lpScope, lpApplicationCountsByBiz, rootEmployees, notes });
  const summary = summarizeCallMetrics(metrics);
  const report = buildCallReport(summary, new Date(), metrics);
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
    await deliverCallReport(report.text, metrics);
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
