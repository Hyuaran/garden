import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { normalizeCallMetricsRpc, parseCallMetricParams } from "@/app/system/_lib/call-metrics";
import { mergeCallMetrics, resolveEmployeeIdForCallMetrics, type RootEmployeeForCallMetrics } from "@/app/system/_lib/call-metrics-merge";
import { countLpApplications, loadLpCustomerRecords, loadLpScope, lpCustomerAppTokenEnv } from "@/app/system/_lib/lp-kintone";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import type { GardenRole } from "@/app/root/_constants/types";
import { STAFF_VIEW_ROLES } from "@/lib/auth/view-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_ROLES = STAFF_VIEW_ROLES;

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

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ ok: false, error: "未ログインです" }, { status: 401 });

  const { data: employee, error: roleError } = await supabase
    .from("root_employees").select("garden_role,is_active,termination_date,deleted_at").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (roleError) return NextResponse.json({ ok: false, error: "権限確認に失敗しました" }, { status: 500 });
  if (!employee || !isEmployeeActive(employee) || !VIEW_ROLES.has(String(employee.garden_role) as GardenRole)) {
    return NextResponse.json({ ok: false, error: "閲覧権限がありません" }, { status: 403 });
  }

  let range;
  try { range = parseCallMetricParams(new URL(request.url).searchParams); }
  catch (error) { return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 }); }

  const { data, error } = await supabase.rpc("system_call_metrics", {
    p_from: range.from, p_to: range.to, p_list_name: range.listName, p_employee_name: range.employeeName,
  });
  if (error) {
    console.error("[system/call-metrics] RPC failed", { code: error.code });
    return NextResponse.json({ ok: false, error: "集計の取得に失敗しました" }, { status: 500 });
  }
  const filemaker = normalizeCallMetricsRpc(data, range);
  const rootEmployees = await loadRootEmployees(supabase);
  const lpScope = await loadLpScope().catch(() => null);
  const lpCircuitIds = [...new Set((lpScope ?? []).flatMap((biz) => biz.circuitIds))];
  const employeeId = resolveEmployeeIdForCallMetrics(range.employeeName, rootEmployees);
  const innoveraResult = await supabase.rpc("system_innovera_metrics", {
    p_from: range.from,
    p_to: range.to,
    p_lp_circuit_ids: lpCircuitIds,
    p_employee_id: employeeId,
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
      const records = recordsByApp.get(biz.customerApp) ?? null;
      if (!records) {
        lpApplicationCountsByBiz.set(biz.bizCode, null);
        notes.push(`LP申込み（kintone）を取得できませんでした：${biz.bizName}`);
      } else {
        lpApplicationCountsByBiz.set(biz.bizCode, countLpApplications(records, range.from, range.to));
      }
    }
  }
  return NextResponse.json({ ok: true, ...mergeCallMetrics({
    filemaker,
    innovera: innoveraResult.error ? null : innoveraResult.data,
    lpScope,
    lpApplicationCountsByBiz,
    rootEmployees,
    notes,
  }) });
}
