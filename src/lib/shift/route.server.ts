import { requireViewEmployee } from "@/lib/auth/system-view-api.server";
import { verifyLiffEmployee } from "@/lib/line/liff-verify.server";
import { myShift, teamShift, ShiftError } from "./service.server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveCanView, type ViewPermission } from "@/lib/auth/view-permission";
import type { GardenRole } from "@/app/root/_constants/types";
export async function shiftRoute(request: Request, action: string, liff = false) {
  try {
    const employee = liff
      ? await verifyLiffEmployee(request.headers.get("authorization")?.replace(/^Bearer /i, ""))
      : await requireViewEmployee(
          "system-shift",
          action === "my" ? "mine" : "team",
          action === "my" ? "employee" : "manager",
        );
    if (employee instanceof Response) return employee;
    if (!employee) return Response.json({ error: "閲覧権限がありません。" }, { status: 403 });
    if (liff) {
      const admin = getSupabaseAdmin();
      const [role, permissions] = await Promise.all([
        admin.from("root_employees").select("garden_role").eq("employee_id", employee.employee_id).single(),
        admin.from("system_view_permissions").select("*").eq("page_key", "system-shift"),
      ]);
      if (role.error || permissions.error) throw new ShiftError("閲覧設定を確認できませんでした。", 503);
      if (
        !resolveCanView(permissions.data as ViewPermission[], "system-shift", "mine", {
          employeeId: employee.employee_id,
          role: role.data.garden_role as GardenRole,
        })
      )
        throw new ShiftError("閲覧権限がありません。", 403);
    }
    const body = request.method === "GET" ? {} : await request.json();
    if (!body || typeof body !== "object" || (request.method === "PUT" && !Array.isArray(body.rows)))
      throw new ShiftError("シフトを入力してください。");
    const month = new URL(request.url).searchParams.get("month") || body.month || "";
    const result =
      action === "my"
        ? await myShift(employee.employee_id, month, request.method === "PUT" ? body.rows : undefined)
        : await teamShift(month, action, body, employee as { employee_id: string; name: string; userId: string });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "処理できませんでした。" },
      { status: error instanceof ShiftError ? error.status : 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
