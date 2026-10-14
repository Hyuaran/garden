import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { normalizeCallMetricsRpc, parseCallMetricParams } from "@/app/system/_lib/call-metrics";
import { mergeCallMetrics, resolveEmployeeIdForCallMetrics, type RootEmployeeForCallMetrics } from "@/app/system/_lib/call-metrics-merge";
import { loadLpContext } from "@/app/system/_lib/lp-context.server";
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

// 集計した時点（as_of）。省略はいま。検算用に ISO で指定できる（例 2026-10-13T23:59:59+09:00）
function parseAsOf(value: string | null) {
  if (!value) return new Date();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("as_of は日時（ISO 形式）で指定してください");
  return date;
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
  let asOf: Date;
  try {
    const params = new URL(request.url).searchParams;
    range = parseCallMetricParams(params);
    asOf = parseAsOf(params.get("as_of"));
  } catch (error) { return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 }); }

  const { data, error } = await supabase.rpc("system_call_metrics", {
    p_from: range.from, p_to: range.to, p_list_name: range.listName, p_employee_name: range.employeeName,
  });
  if (error) {
    console.error("[system/call-metrics] RPC failed", { code: error.code });
    return NextResponse.json({ ok: false, error: "集計の取得に失敗しました" }, { status: 500 });
  }
  const filemaker = normalizeCallMetricsRpc(data, range);
  const rootEmployees = await loadRootEmployees(supabase);
  const employeeId = resolveEmployeeIdForCallMetrics(range.employeeName, rootEmployees);
  // 先に INNOVERA の集計（has_rows）を読み、LP系の読み込みと突き合わせに渡す
  const lpKintone = await loadLpContext({ client: supabase, from: range.from, to: range.to, asOf, hasInnoveraRows: true });
  const innoveraResult = await supabase.rpc("system_innovera_metrics", {
    p_from: range.from,
    p_to: range.to,
    p_lp_circuit_ids: lpKintone.lpCircuitIds,
    p_employee_id: employeeId,
  });
  const merged = mergeCallMetrics({
    filemaker,
    innovera: innoveraResult.error ? null : innoveraResult.data,
    lpScope: lpKintone.lpScope,
    lpApplicationCountsByBiz: lpKintone.lpApplicationCountsByBiz,
    rootEmployees,
    notes: lpKintone.notes,
  });
  return NextResponse.json({ ok: true, ...merged, lpFunnel: lpKintone.funnel, lpFormCount: lpKintone.formCount });
}
