import { NextResponse } from "next/server";
import { createServerClient } from "@/app/_lib/supabase/server";
import { normalizeCallMetricsRpc, parseCallMetricParams } from "@/app/system/_lib/call-metrics";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import type { GardenRole } from "@/app/root/_constants/types";
import { MANAGER_VIEW_ROLES } from "@/lib/auth/view-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VIEW_ROLES = MANAGER_VIEW_ROLES;

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
  return NextResponse.json({ ok: true, ...normalizeCallMetricsRpc(data, range) });
}
