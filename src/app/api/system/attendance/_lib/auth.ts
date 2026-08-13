import { createServerClient } from "@/app/_lib/supabase/server";

export async function resolveAttendanceEmployee() {
  const session = await createServerClient();
  const { data: auth } = await session.auth.getUser();
  if (!auth.user) return { ok: false as const, status: 401 as const, error: "未ログインです" };
  const { data: employee, error } = await session.from("root_employees")
    .select("employee_id,name,garden_role")
    .eq("user_id", auth.user.id).eq("is_active", true).is("deleted_at", null).maybeSingle();
  if (error) return { ok: false as const, status: 500 as const, error: "従業員情報の確認に失敗しました" };
  if (!employee) return {
    ok: false as const, status: 409 as const, error: "打刻対象の従業員として登録されていません（管理者にご連絡ください）",
    errorCode: "EMPLOYEE_NOT_REGISTERED",
  };
  return { ok: true as const, employee: { id: String(employee.employee_id), name: String(employee.name), gardenRole: String(employee.garden_role) } };
}
