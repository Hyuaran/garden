import { NextResponse } from "next/server";
import { isRoleAtLeast } from "@/app/root/_constants/types";
import { listInnoveraUsers } from "@/lib/innovera/client";
import { callAccessErrorResponse, requireCallAccess } from "@/lib/innovera/calls.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

export async function GET() {
  try {
    const ctx = await requireCallAccess();
    if (!isRoleAtLeast(ctx.role, "admin")) {
      return NextResponse.json({ ok: false, error: "管理者権限が必要です" }, { status: 403 });
    }
    const [users, employeesResult] = await Promise.all([
      listInnoveraUsers(),
      getSupabaseAdmin()
        .from("root_employees")
        .select("employee_id,name,innovera_extension,innovera_mobile_extension,is_active,termination_date,deleted_at")
        .eq("is_active", true)
        .is("deleted_at", null),
    ]);
    const employees = employeesResult.data ?? [];
    const employeeByExtension = new Map();
    for (const employee of employees) {
      for (const extension of [employee.innovera_extension, employee.innovera_mobile_extension]) {
        const key = text(extension);
        if (key) employeeByExtension.set(key, employee);
      }
    }
    const userByExtension = new Map(users.map((user) => [text(user.number), user]));
    const unmappedEmployees = employees.filter(
      (employee) => {
        const extensions = [employee.innovera_extension, employee.innovera_mobile_extension].map(text).filter(Boolean);
        return extensions.length === 0 || extensions.some((extension) => !userByExtension.has(extension));
      },
    );
    const unmappedUsers = users.filter((user) => user.number && !employeeByExtension.has(text(user.number)));
    const mapped = users
      .map((user) => ({ user, employee: employeeByExtension.get(text(user.number)) ?? null }))
      .filter((row) => row.employee);
    return NextResponse.json({ ok: true, mapped, unmappedEmployees, unmappedUsers });
  } catch (error) {
    try {
      return callAccessErrorResponse(error);
    } catch {
      return NextResponse.json({ ok: false, error: "紐づけ確認に失敗しました" }, { status: 500 });
    }
  }
}
