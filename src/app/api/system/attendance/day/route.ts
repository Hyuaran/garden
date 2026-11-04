import { requireSystemView } from "@/lib/auth/view-permission.server";
import { parseJstDate } from "@/app/system/_lib/attendance";
import { checked } from "@/lib/attendance/kot-punch-push.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const target = params.get("employee_id");
    const context = await requireSystemView(
      "system-attendance",
      target ? "approve" : "request",
    );
    const range = parseJstDate(params.get("date"));
    const punches = checked(
      await getSupabaseAdmin()
        .from("system_attendance_punches")
        .select("id,punch_type,punched_at,kot_sync_status")
        .eq("employee_id", target || context.viewer.employeeId)
        .is("voided_at", null)
        .gte("punched_at", range.from)
        .lt("punched_at", range.to)
        .order("punched_at"),
    );
    return Response.json({ punches });
  } catch {
    return Response.json(
      { error: "打刻を読み込めませんでした。" },
      { status: 403 },
    );
  }
}
