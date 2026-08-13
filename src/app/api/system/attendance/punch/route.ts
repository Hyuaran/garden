import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { CLIENT_PUNCH_ID_PATTERN, isPunchType } from "@/app/system/_lib/attendance";
import { resolveAttendanceEmployee } from "../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await resolveAttendanceEmployee();
  if (!identity.ok) return NextResponse.json({ ok: false, error: identity.error, error_code: "errorCode" in identity ? identity.errorCode : undefined }, { status: identity.status });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "JSON本文が不正です" }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (!isPunchType(input.punch_type)) return NextResponse.json({ ok: false, error: "打刻種別が不正です" }, { status: 400 });
  if (typeof input.client_punch_id !== "string" || !CLIENT_PUNCH_ID_PATTERN.test(input.client_punch_id)) {
    return NextResponse.json({ ok: false, error: "client_punch_idはUUID形式で指定してください" }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
  const payload = {
    employee_id: identity.employee.id, punch_type: input.punch_type,
    client_punch_id: input.client_punch_id, source: "web", user_agent: userAgent,
  };
  const { data, error } = await admin.from("system_attendance_punches")
    .insert(payload).select("id,employee_id,punch_type,punched_at,kot_sync_status").single();
  if (!error && data) return NextResponse.json({ ok: true, idempotent: false, punch: data }, { status: 201 });
  if (error?.code !== "23505") {
    console.error("[system/attendance/punch] insert failed", { code: error?.code ?? "unknown" });
    return NextResponse.json({ ok: false, error: "打刻を記録できませんでした" }, { status: 500 });
  }
  const { data: existing, error: existingError } = await admin.from("system_attendance_punches")
    .select("id,employee_id,punch_type,punched_at,kot_sync_status")
    .eq("client_punch_id", input.client_punch_id).maybeSingle();
  if (existingError || !existing || String(existing.employee_id) !== identity.employee.id || existing.punch_type !== input.punch_type) {
    return NextResponse.json({ ok: false, error: "打刻IDが競合しました" }, { status: 409 });
  }
  return NextResponse.json({ ok: true, idempotent: true, punch: existing });
}
