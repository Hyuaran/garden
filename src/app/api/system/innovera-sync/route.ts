import { NextResponse } from "next/server";

import { createServerClient } from "@/app/_lib/supabase/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { isEmployeeActive } from "@/lib/auth/employee-access";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runInnoveraSync } from "@/lib/innovera/sync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function requireStaff() {
  const supabase = await createServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return { ok: false as const, response: NextResponse.json({ ok: false, error: "login_required" }, { status: 401 }) };

  const { data: employee, error } = await getSupabaseAdmin()
    .from("root_employees")
    .select("employee_id,garden_role,is_active,termination_date,deleted_at")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return { ok: false as const, response: NextResponse.json({ ok: false, error: "auth_failed" }, { status: 500 }) };
  if (!employee || !isEmployeeActive(employee)) return { ok: false as const, response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  const role = (employee as { garden_role?: GardenRole | null }).garden_role ?? "staff";
  if (!isRoleAtLeast(role, "staff")) return { ok: false as const, response: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  return { ok: true as const, employeeId: String((employee as { employee_id?: unknown }).employee_id ?? "") };
}

export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const result = await runInnoveraSync({ apply: false, trigger: "manual", actorEmployeeId: auth.employeeId, includeLogs: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const result = await runInnoveraSync({ apply: true, trigger: "manual", actorEmployeeId: auth.employeeId, includeLogs: true });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
