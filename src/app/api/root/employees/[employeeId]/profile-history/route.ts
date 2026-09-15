import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getCurrentProfile, getProfileHistory } from "@/app/root/_lib/profile-history.server";

export async function GET(_request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const { employeeId } = await params;
  const admin = getSupabaseAdmin();
  const { data: roleRow } = await admin.from("root_employees").select("garden_role").eq("employee_id", manager.employee_id).maybeSingle();
  const revealBankAccount = ["admin", "super_admin"].includes(String(roleRow?.garden_role ?? ""));
  const [current, rows] = await Promise.all([
    getCurrentProfile(admin, employeeId, revealBankAccount),
    getProfileHistory(admin, employeeId, revealBankAccount),
  ]);
  return NextResponse.json({
    ok: true,
    currentIds: Object.fromEntries(Object.entries(current).map(([category, row]) => [category, row.id ?? null])),
    rows,
  });
}
