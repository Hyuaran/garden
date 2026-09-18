import { NextResponse } from "next/server";
import { requireManager, requireStaff } from "@/app/system/mypage/_lib/submission-server";
import { SHUKKIN_GROUPS, type ShukkinGroup } from "@/app/system/forms/shukkin/_lib/shukkin";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const SELECT_COLUMNS = "employee_number,group_name,sort_order,active,display_name";

type RequestMember = {
  employeeNumber?: unknown;
  groupName?: unknown;
  sortOrder?: unknown;
  active?: unknown;
  displayName?: unknown;
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
      display_name: typeof member.displayName === "string" && member.displayName.trim() ? member.displayName.trim() : null,
    };
  });
  return rows.every(Boolean) ? rows : null;
}

async function employeeNamesByNumber(client: ReturnType<typeof getSupabaseAdmin>, employeeNumbers: string[]) {
  const numbers = [...new Set(employeeNumbers)].filter(Boolean);
  if (numbers.length === 0) return new Map<string, string>();
  const { data, error } = await client
    .from("root_employees")
    .select("employee_number,name")
    .in("employee_number", numbers);
  if (error) throw error;
  return new Map((data ?? []).map((row) => {
    const item = row as { employee_number: string; name: string | null };
    return [item.employee_number, String(item.name ?? "")];
  }));
}

function shapeRows(rows: unknown[], employeeNames: Map<string, string>) {
  return rows.map((row) => {
    const item = row as {
      employee_number: string;
      group_name: ShukkinGroup;
      sort_order: number;
      active: boolean;
      display_name?: string | null;
    };
    return {
      employeeNumber: item.employee_number,
      name: employeeNames.get(item.employee_number) ?? "",
      displayName: String(item.display_name ?? ""),
      groupName: item.group_name,
      sortOrder: item.sort_order,
      active: item.active,
    };
  });
}

export async function GET() {
  const staff = await requireStaff();
  if (!staff) return NextResponse.json({ ok: false }, { status: 403 });
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("system_shukkin_member")
    .select(SELECT_COLUMNS)
    .eq("active", true)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "並びの設定を読み込めませんでした" }, { status: 500 });
  try {
    const employeeNames = await employeeNamesByNumber(client, (data ?? []).map((row) => String(row.employee_number ?? "")));
    return NextResponse.json({ ok: true, members: shapeRows(data ?? [], employeeNames) });
  } catch {
    return NextResponse.json({ ok: false, error: "並びの設定を読み込めませんでした" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const manager = await requireManager();
  if (!manager) return NextResponse.json({ ok: false }, { status: 403 });
  const body = await request.json().catch(() => null) as { members?: unknown } | null;
  const rows = normalizeMembers(body?.members);
  if (!rows) return NextResponse.json({ ok: false, error: "並びの設定を確認してください" }, { status: 400 });

  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from("system_shukkin_member")
    .upsert(rows.map((row) => ({ ...row, updated_by: manager.userId })), { onConflict: "employee_number" })
    .select(SELECT_COLUMNS)
    .order("group_name", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) return NextResponse.json({ ok: false, error: "並びの設定を保存できませんでした" }, { status: 500 });
  try {
    const employeeNames = await employeeNamesByNumber(client, (data ?? []).map((row) => String(row.employee_number ?? "")));
    return NextResponse.json({ ok: true, members: shapeRows(data ?? [], employeeNames) });
  } catch {
    return NextResponse.json({ ok: false, error: "並びの設定を保存できませんでした" }, { status: 500 });
  }
}
