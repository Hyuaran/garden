import "server-only";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
export { loadPoints } from "@/lib/product-points/load-points";

export async function productPointsContext(write = false) {
  const employee = await requireEmployee();
  if (!employee) throw new Error("権限がありません。");
  const { viewer } = await viewPermissionContext();
  if (!await canView("soil-product-points", "", viewer)) throw new Error("閲覧権限がありません。");
  const db = getSupabaseAdmin();
  // 全権管理者のほか、毎月登録する営業（soil_product_points_editors の社員番号）も変更できる。
  let canWrite = viewer.role === "super_admin";
  if (!canWrite && employee.employee_number) {
    const { data } = await db.from("soil_product_points_editors").select("employee_number")
      .eq("employee_number", employee.employee_number).maybeSingle();
    canWrite = Boolean(data);
  }
  if (write && !canWrite) throw new Error("付与ポイント表を変更できるのは、全権管理者と登録の担当者です。");
  return { db, employee, canWrite };
}
