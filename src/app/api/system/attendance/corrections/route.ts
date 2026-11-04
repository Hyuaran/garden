import { requireSystemView } from "@/lib/auth/view-permission.server";
import { resolveAttendanceEmployee } from "../_lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseJstDate, isPunchType } from "@/app/system/_lib/attendance";
import { checked } from "@/lib/attendance/kot-punch-push.server";
export const dynamic = "force-dynamic";
function failure(error: unknown) {
  const status =
    error && typeof error === "object" && "status" in error
      ? Number(error.status)
      : 400;
  return Response.json(
    {
      error:
        error instanceof Error
          ? error.message
          : "修正の申請を処理できませんでした。",
    },
    { status },
  );
}
export async function GET(request: Request) {
  try {
    const approve = new URL(request.url).searchParams.get("approve") === "true";
    const context = await requireSystemView(
      "system-attendance",
      approve ? "approve" : "request",
    );
    let query = getSupabaseAdmin()
      .from("system_attendance_corrections")
      .select(
        "*,root_employees!system_attendance_corrections_employee_id_fkey(name)",
      )
      .order("created_at", { ascending: false });
    if (!approve) query = query.eq("employee_id", context.viewer.employeeId);
    const rows = checked(await query.limit(1000));
    return Response.json({
      rows:
        rows?.map((row) => ({
          ...row,
          can_decide:
            context.viewer.role === "super_admin" ||
            row.employee_id !== context.viewer.employeeId,
        })) || [],
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireSystemView("system-attendance", "request");
    const identity = await resolveAttendanceEmployee();
    if (!identity.ok)
      return Response.json(
        { error: identity.error },
        { status: identity.status },
      );
    const body = await request.json();
    if (typeof body.work_date !== "string")
      throw new Error("日付を入力してください。");
    const range = parseJstDate(body.work_date);
    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });
    if (
      range.date > today ||
      !["add", "change", "delete"].includes(body.action) ||
      !isPunchType(body.punch_type) ||
      typeof body.reason !== "string" ||
      !body.reason.trim() ||
      body.reason.length > 2000
    )
      throw new Error("日付と修正の内容、理由を確認してください。");
    const db = getSupabaseAdmin();
    if (body.action !== "add") {
      const target = checked(
        await db
          .from("system_attendance_punches")
          .select("id,punch_type")
          .eq("id", body.target_punch_id)
          .eq("employee_id", identity.employee.id)
          .is("voided_at", null)
          .gte("punched_at", range.from)
          .lt("punched_at", range.to)
          .single(),
      );
      if (!target || target.punch_type !== body.punch_type)
        throw new Error("対象の打刻を確認してください。");
    }
    let time: string | null = null;
    if (body.action !== "delete") {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))
        throw new Error("時刻を入力してください。");
      time = `${range.date}T${body.time}:00+09:00`;
    }
    checked(
      await db.from("system_attendance_corrections").insert({
        employee_id: identity.employee.id,
        work_date: range.date,
        action: body.action,
        punch_type: body.punch_type,
        target_punch_id: body.action === "add" ? null : body.target_punch_id,
        requested_time: time,
        reason: body.reason.trim(),
      }),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const context = await requireSystemView(
      "system-attendance",
      body.decision === "canceled" ? "request" : "approve",
    );
    const db = getSupabaseAdmin();
    if (body.decision === "fixed") {
      checked(
        await db
          .from("system_attendance_corrections")
          .update({
            kot_fixed_at: new Date().toISOString(),
            kot_fixed_by: context.viewer.employeeId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", body.id)
          .eq("status", "approved")
          .eq("kot_fix_needed", true),
      );
    } else {
      if (!["approved", "rejected", "canceled"].includes(body.decision))
        throw new Error("操作を確認してください。");
      const result = await db.rpc("decide_attendance_correction", {
        p_id: body.id,
        p_actor: context.viewer.employeeId,
        p_decision: body.decision,
        p_comment: typeof body.comment === "string" ? body.comment : "",
        p_super: context.viewer.role === "super_admin",
      });
      if (result.error) throw new Error(result.error.message);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
