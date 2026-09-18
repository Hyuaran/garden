import { NextResponse } from "next/server";
import { requireManager, requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { SHUKKIN_GROUPS, type ShukkinGroup } from "@/app/system/forms/shukkin/_lib/shukkin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SELECT_COLUMNS = "employee_number,group_name,sort_order,active,root_employees(name)";

type RequestMember = {
  employeeNumber?: unknown;
  groupName?: unknown;
  sortOrder?: unknown;
  active?: unknown;
};

function validGroup(value: unknown): value is ShukkinGroup {
  return typeof value === "string" && (SHUKKIN_GROUPS as readonly string[]).includes(value);
}

function normalizeMembers(value: unknown) {
  if (!Array.isArray(value)) return null;
  const rows = value.map((item, index) => {
    const member = item as RequestMember;
    const employeeNumber = String(member.employeeNumber ?? "").trim().padStart(4, "0");
    if (!/^\d{4}$/.test(employeeNumber) || !validGroup(member.groupName)) return null;
    const sortOrder = Number(member.sortOrder ?? (index + 1) * 10);
    return {
      employee_number: employeeNumber,
      group_name: member.groupName,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : (index + 1) * 10,
      active: member.active !== false,
    };
  });
  return rows.every(Boolean) ? rows : null;
}

function shapeRows(rows: unknown[]) {
  return rows.map((row) => {
    const item = row as {
      employee_number: string;
      group_name: ShukkinGroup;
      sort_order: number;
      active: boolean;
      root_employees?: { name?: string | null } | Array<{ name?: string | null }> | null;
    };
    const employee = Array.isArray(item.root_employees) ? item.root_employees[0] : item.root_employees;
    return {
      employeeNumber: item.employee_number,
      name: String(employee?.name ?? ""),
      groupName: item.group_name,
      sortOrder: item.sort_order,
      active: item.active,
    };
  });
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const { data, error } = await getSupabaseAdmin()
    .from("system_shukkin_member")
    .select(SELECT_COLUMNS)
    .eq("active", true)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "並びの設定を読み込めませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, members: shapeRows(data ?? []) });
}

export async function PUT(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { members?: unknown } | null;
  const rows = normalizeMembers(body?.members);
  if (!rows) return NextResponse.json({ ok: false, error: "並びの設定を確認してください" }, { status: 400 });

  const { data, error } = await getSupabaseAdmin()
    .from("system_shukkin_member")
    .upsert(rows.map((row) => ({ ...row, updated_by: manager.userId })), { onConflict: "employee_number" })
    .select(SELECT_COLUMNS)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "並びの設定を保存できませんでした" }, { status: 500 });
  return NextResponse.json({ ok: true, members: shapeRows(data ?? []) });
}
