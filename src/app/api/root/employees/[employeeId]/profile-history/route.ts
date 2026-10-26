import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireSystemView } from "@/lib/auth/view-permission.server";
import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { getCurrentProfile, getProfileHistory } from "@/app/root/_lib/profile-history.server";

export async function GET(_request: Request, { params }: { params: Promise<{ employeeId: string }> }) {
  const denied = await systemViewResponse("root-employees");
  if (denied) return denied;
  const { viewer } = await requireSystemView("root-employees");
  const { employeeId } = await params;
  const admin = getSupabaseAdmin();
  const revealBankAccount = ["admin", "super_admin"].includes(viewer.role);
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
