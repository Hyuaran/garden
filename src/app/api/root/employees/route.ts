import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isRetiredByDate } from "@/lib/auth/employee-access";
import { retireAuthIfNeeded, writeRetirementToRoster } from "@/app/root/_lib/roster-sync.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  const employeeId = typeof body?.employee_id === "string" ? body.employee_id : "";
  if (!employeeId) return NextResponse.json({ ok: false, error: "employee_id is required" }, { status: 400 });
  const input = body;

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("root_employees")
    .select("user_id,kot_employee_id,termination_date,is_active")
    .eq("employee_id", employeeId)
    .maybeSingle();

  const terminationDate = typeof input.termination_date === "string" && input.termination_date ? input.termination_date : null;
  const retired = isRetiredByDate(terminationDate);
  const payload = { ...input, termination_date: terminationDate, is_active: retired ? false : input.is_active };
  const { error } = await admin.from("root_employees").upsert(payload, { onConflict: "employee_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let rosterSync: Awaited<ReturnType<typeof writeRetirementToRoster>> | null = null;
  if (retired) {
    await retireAuthIfNeeded(admin, { user_id: typeof existing?.user_id === "string" ? existing.user_id : null, termination_date: terminationDate, is_active: false });
    rosterSync = await writeRetirementToRoster({
      kot_employee_id: typeof existing?.kot_employee_id === "string" ? existing.kot_employee_id : typeof input.kot_employee_id === "string" ? input.kot_employee_id : null,
      termination_date: terminationDate,
    });
  }

  return NextResponse.json({ ok: true, retired, rosterSync });
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { employee_id?: unknown; is_active?: unknown } | null;
  const employeeId = typeof body?.employee_id === "string" ? body.employee_id : "";
  if (!employeeId || typeof body?.is_active !== "boolean") {
    return NextResponse.json({ ok: false, error: "employee_id and is_active are required" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: employee } = await admin.from("root_employees").select("user_id,termination_date").eq("employee_id", employeeId).maybeSingle();
  const retired = isRetiredByDate(typeof employee?.termination_date === "string" ? employee.termination_date : null);
  const nextActive = retired ? false : body.is_active;
  const { error } = await admin.from("root_employees").update({ is_active: nextActive }).eq("employee_id", employeeId);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  await retireAuthIfNeeded(admin, {
    user_id: typeof employee?.user_id === "string" ? employee.user_id : null,
    termination_date: typeof employee?.termination_date === "string" ? employee.termination_date : null,
    is_active: nextActive,
  });
  return NextResponse.json({ ok: true, is_active: nextActive });
}
