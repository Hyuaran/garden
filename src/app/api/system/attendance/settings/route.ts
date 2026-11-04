import { requireSystemView } from "@/lib/auth/view-permission.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  attendanceSettings,
  checked,
} from "@/lib/attendance/kot-punch-push.server";
import { parseJstDate } from "@/app/system/_lib/attendance";

export async function GET() {
  try {
    const context = await requireSystemView("system-attendance");
    if (context.viewer.role !== "super_admin")
      return Response.json({ error: "閲覧権限がありません" }, { status: 403 });
    return Response.json(await attendanceSettings());
  } catch {
    return Response.json(
      { error: "設定を読み込めませんでした。" },
      { status: 403 },
    );
  }
}
export async function PUT(request: Request) {
  try {
    const context = await requireSystemView("system-attendance");
    if (context.viewer.role !== "super_admin")
      return Response.json({ error: "閲覧権限がありません" }, { status: 403 });
    const body = await request.json();
    if (
      body.kot_send_start_date !== null &&
      typeof body.kot_send_start_date !== "string"
    )
      throw new Error("開始日を入力してください。");
    const date =
      body.kot_send_start_date === null
        ? null
        : parseJstDate(body.kot_send_start_date).date;
    checked(
      await getSupabaseAdmin()
        .from("system_attendance_settings")
        .update({
          kot_send_start_date: date,
          updated_at: new Date().toISOString(),
          updated_by: context.viewer.employeeId,
        })
        .eq("id", true),
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "開始日を保存できませんでした。" },
      { status: 400 },
    );
  }
}
