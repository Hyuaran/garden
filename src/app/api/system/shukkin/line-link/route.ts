import { systemViewResponse } from "@/lib/auth/view-permission.server";
import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
import { NextResponse } from "next/server";
import { requireManager } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

import { syncRichMenus } from '@/lib/line/richmenu.server';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeEmployeeNumber(value: unknown) {
  return String(value ?? "").trim().padStart(4, "0");
}

function displayDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
}

export async function GET() {
  const manager = await requireViewEmployee("system-forms", "input", "manager");
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const client = getSupabaseAdmin();
  const { data: memberRows, error: memberError } = await client
    .from("system_shukkin_member")
    .select("employee_number,group_name,sort_order,active")
    .eq("active", true)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (memberError) return NextResponse.json({ ok: false, error: "LINE の紐づけを読み込めませんでした" }, { status: 500 });

  const numbers = (memberRows ?? []).map((row) => String(row.employee_number ?? ""));
  const { data: employeeRows, error: employeeError } = await client
    .from("root_employees")
    .select("employee_id,employee_number,name,line_user_id,line_display_name,line_link_source")
    .in("employee_number", numbers);
  if (employeeError) return NextResponse.json({ ok: false, error: "LINE の紐づけを読み込めませんでした" }, { status: 500 });

  const employeeByNumber = new Map((employeeRows ?? []).map((row) => [String(row.employee_number ?? ""), row]));
  const members = (memberRows ?? []).map((member) => {
    const employee = employeeByNumber.get(String(member.employee_number ?? "")) as {
      employee_id?: string | null;
      name?: string | null;
      line_user_id?: string | null;
      line_display_name?: string | null;
      line_link_source?: string | null;
    } | undefined;
    return {
      employeeNumber: String(member.employee_number ?? ""),
      name: String(employee?.name ?? ""),
      lineUserId: employee?.line_user_id ?? null,
      lineDisplayName: employee?.line_display_name ?? null,
      lineLinkSource: employee?.line_link_source ?? null,
    };
  });

  const { data: pendingRows, error: pendingError } = await client
    .from("system_line_staff_pending")
    .select("line_user_id,display_name,last_text,last_seen_at")
    .order("last_seen_at", { ascending: false });
  if (pendingError) return NextResponse.json({ ok: false, error: "LINE の紐づけを読み込めませんでした" }, { status: 500 });

  return NextResponse.json({
    ok: true,
    members,
    pending: (pendingRows ?? []).map((row) => ({
      lineUserId: String(row.line_user_id ?? ""),
      displayName: String(row.display_name ?? ""),
      lastText: String(row.last_text ?? ""),
      lastSeenAt: String(row.last_seen_at ?? ""),
      lastSeenAtLabel: displayDateTime(String(row.last_seen_at ?? "")),
    })),
  });
}

export async function POST(request: Request) {
  for (const scopeTab of ["input"]) {
    const viewDenied = await systemViewResponse("system-forms", scopeTab, true);
    if (viewDenied) return viewDenied;
  }

  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { lineUserId?: unknown; employeeNumber?: unknown } | null;
  const lineUserId = typeof body?.lineUserId === "string" ? body.lineUserId.trim() : "";
  const employeeNumber = normalizeEmployeeNumber(body?.employeeNumber);
  if (!lineUserId || !/^\d{4}$/.test(employeeNumber)) return NextResponse.json({ ok: false, error: "紐づける人を確認してください" }, { status: 400 });

  const client = getSupabaseAdmin();
  const { data: pending } = await client
    .from("system_line_staff_pending")
    .select("display_name")
    .eq("line_user_id", lineUserId)
    .maybeSingle<{ display_name?: string | null }>();
  const { error: clearError } = await client
    .from("root_employees")
    .update({ line_user_id: null, line_display_name: null, line_link_source: "admin_unlink" })
    .eq("line_user_id", lineUserId);
  if (clearError) return NextResponse.json({ ok: false, error: "紐づけを保存できませんでした" }, { status: 500 });

  const { error: updateError } = await client
    .from("root_employees")
    .update({
      line_user_id: lineUserId,
      line_display_name: pending?.display_name ?? null,
      line_linked_at: new Date().toISOString(),
      line_link_source: "admin",
    })
    .eq("employee_number", employeeNumber)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (updateError) return NextResponse.json({ ok: false, error: "紐づけを保存できませんでした" }, { status: 500 });
  await client.from("system_line_staff_pending").delete().eq("line_user_id", lineUserId);
  // LINE のメニューの付け替えに失敗しても、社員の更新・紐づけ自体は成功として返す（次の反映でそろう）
  await syncRichMenus().catch(error => console.error('line_richmenu_sync_failed', error instanceof Error ? error.message : error));
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  for (const scopeTab of ["input"]) {
    const viewDenied = await systemViewResponse("system-forms", scopeTab, true);
    if (viewDenied) return viewDenied;
  }

  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { employeeNumber?: unknown } | null;
  const employeeNumber = normalizeEmployeeNumber(body?.employeeNumber);
  if (!/^\d{4}$/.test(employeeNumber)) return NextResponse.json({ ok: false, error: "外す人を確認してください" }, { status: 400 });
  const { error } = await getSupabaseAdmin()
    .from("root_employees")
    .update({
      line_user_id: null,
      line_display_name: null,
      line_linked_at: new Date().toISOString(),
      line_link_source: "admin_unlink",
    })
    .eq("employee_number", employeeNumber);
  if (error) return NextResponse.json({ ok: false, error: "紐づけを外せませんでした" }, { status: 500 });
  // LINE のメニューの付け替えに失敗しても、社員の更新・紐づけ自体は成功として返す（次の反映でそろう）
  await syncRichMenus().catch(error => console.error('line_richmenu_sync_failed', error instanceof Error ? error.message : error));
  return NextResponse.json({ ok: true });
}
