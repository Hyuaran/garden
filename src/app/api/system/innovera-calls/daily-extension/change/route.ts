import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isRoleAtLeast, type GardenRole } from "@/app/root/_constants/types";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import {
  getActiveDailyExtensionForEmployee,
  tokyoToday,
  validateDailyExtension,
  validateExtensionAvailability,
} from "@/lib/innovera/daily-extension";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function syntheticEmail(employeeNumber: string) {
  const digits = employeeNumber.replace(/\D/g, "").padStart(4, "0");
  return `emp${digits}@garden.internal`;
}

function anonAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase 環境変数が未設定です");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  let ctx: Awaited<ReturnType<typeof requireCallAccess>>;
  try {
    ctx = await requireCallAccess();
  } catch (error) {
    return callAccessErrorResponse(error);
  }
  if (!ctx.usesDailyExtension) {
    return NextResponse.json({ ok: false, error: "固定席の内線は Root の従業員情報で変更します" }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "JSON本文が不正です" }, { status: 400 }); }
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const extensionResult = validateDailyExtension(input.extension);
  if (!extensionResult.ok) return NextResponse.json({ ok: false, error: extensionResult.error }, { status: extensionResult.status });
  const adminEmployeeNumber = String(input.adminEmployeeNumber ?? "").trim();
  const adminPassword = String(input.adminPassword ?? "");
  if (!adminEmployeeNumber || !adminPassword) {
    return NextResponse.json({ ok: false, error: "管理者の社員番号またはパスワードが違います" }, { status: 401 });
  }

  const authClient = anonAuthClient();
  const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
    email: syntheticEmail(adminEmployeeNumber),
    password: adminPassword,
  });
  await authClient.auth.signOut();
  if (signInError || !signIn.user) {
    console.info("[daily-extension/change]", { employeeId: ctx.employeeId, to: extensionResult.extension, approver: adminEmployeeNumber, result: "auth_failed" });
    return NextResponse.json({ ok: false, error: "管理者の社員番号またはパスワードが違います" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: approver, error: approverError } = await admin
    .from("root_employees")
    .select("employee_id,name,garden_role,is_active,deleted_at")
    .eq("user_id", signIn.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (approverError || !approver || !isRoleAtLeast(String(approver.garden_role) as GardenRole, "manager")) {
    console.info("[daily-extension/change]", { employeeId: ctx.employeeId, to: extensionResult.extension, approver: adminEmployeeNumber, result: "forbidden" });
    return NextResponse.json({ ok: false, error: "責任者以上の権限が必要です" }, { status: 403 });
  }

  const workDate = tokyoToday();
  const current = await getActiveDailyExtensionForEmployee(admin, ctx.employeeId, workDate);
  const from = current?.extension ? String(current.extension) : "";
  const available = await validateExtensionAvailability(admin, ctx.employeeId, extensionResult.extension, workDate);
  if (!available.ok) {
    console.info("[daily-extension/change]", { employeeId: ctx.employeeId, from, to: extensionResult.extension, approver: approver.employee_id, result: "conflict" });
    return NextResponse.json({ ok: false, error: available.error }, { status: available.status });
  }
  if (current?.id) {
    const { error } = await admin
      .from("system_innovera_daily_extension")
      .update({ ended_at: new Date().toISOString(), ended_reason: "admin_change" })
      .eq("id", current.id);
    if (error) return NextResponse.json({ ok: false, error: "内線番号を変更できませんでした" }, { status: 500 });
  }
  const { data: created, error: createError } = await admin
    .from("system_innovera_daily_extension")
    .insert({
      employee_id: ctx.employeeId,
      work_date: workDate,
      extension: extensionResult.extension,
      source: "admin_change",
      approved_by_employee_id: String(approver.employee_id),
    })
    .select("id,extension,started_at")
    .single();
  if (createError || !created) {
    console.info("[daily-extension/change]", { employeeId: ctx.employeeId, from, to: extensionResult.extension, approver: approver.employee_id, result: "insert_failed" });
    return NextResponse.json({ ok: false, error: "内線番号を変更できませんでした" }, { status: 500 });
  }
  console.info("[daily-extension/change]", { employeeId: ctx.employeeId, from, to: extensionResult.extension, approver: approver.employee_id, result: "ok" });
  return NextResponse.json({ ok: true, dailyExtension: created });
}
