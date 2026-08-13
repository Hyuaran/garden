import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { MANAGER_ROLES } from "@/app/system/_lib/attendance";
import { resolveAttendanceEmployee } from "../_lib/auth";

export const dynamic = "force-dynamic";
const LIST_LIMIT = 200;

export async function GET() {
  const identity = await resolveAttendanceEmployee();
  if (!identity.ok) return NextResponse.json({ ok: false, error: identity.error, error_code: "errorCode" in identity ? identity.errorCode : undefined }, { status: identity.status });
  if (!MANAGER_ROLES.has(identity.employee.gardenRole)) return NextResponse.json({ ok: false, error: "閲覧権限がありません" }, { status: 403 });
  const admin = getSupabaseAdmin();
  const statuses = ["unsent", "failed", "resend_wait", "needs_check"];
  const countResults = await Promise.all(statuses.map((status) => admin.from("system_attendance_punches")
    .select("id", { count: "exact", head: true }).eq("kot_sync_status", status)));
  if (countResults.some((result) => result.error)) return NextResponse.json({ ok: false, error: "同期状況を取得できませんでした" }, { status: 500 });
  const counts = Object.fromEntries(statuses.map((status, index) => [status, countResults[index].count ?? 0]));
  const { data, error } = await admin.from("system_attendance_punches")
    .select("id,employee_id,punch_type,punched_at,kot_sync_status,root_employees:root_employees!system_attendance_punches_employee_id_fkey(name,kot_employee_id)")
    .in("kot_sync_status", ["unsent", "failed", "resend_wait", "needs_check"])
    .order("punched_at", { ascending: false }).limit(LIST_LIMIT);
  if (error) return NextResponse.json({ ok: false, error: "同期状況を取得できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, counts, punches: data ?? [], limit: LIST_LIMIT });
}
