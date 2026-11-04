import { canView, systemViewResponse } from "@/lib/auth/view-permission.server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseJstDate } from "@/app/system/_lib/attendance";
import { resolveAttendanceEmployee } from "../_lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewDenied = await systemViewResponse("system-attendance", "punch");
  if (viewDenied) return viewDenied;

  const identity = await resolveAttendanceEmployee();
  if (!identity.ok) return NextResponse.json({ ok: false, error: identity.error, error_code: "errorCode" in identity ? identity.errorCode : undefined }, { status: identity.status });
  let range;
  try { range = parseJstDate(new URL(request.url).searchParams.get("date")); }
  catch (error) { return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 400 }); }
  const { data, error } = await getSupabaseAdmin().from("system_attendance_punches")
    .select("id,punch_type,punched_at,kot_sync_status,device_type").is("voided_at", null)
    .eq("employee_id", identity.employee.id).gte("punched_at", range.from).lt("punched_at", range.to)
    .order("punched_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: "打刻一覧を取得できませんでした" }, { status: 500 });
  const canApprove = await canView("system-attendance", "approve", {
    employeeId: identity.employee.id,
    role: identity.employee.gardenRole as import("@/app/root/_constants/types").GardenRole,
  });
  return NextResponse.json({ attendanceRule: identity.employee.attendanceRule, canApprove, ok: true, date: range.date, punches: data ?? [] });
}
