import "server-only";
import { requireEmployee } from "@/app/system/mypage/_lib/submission-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { canView, viewPermissionContext } from "@/lib/auth/view-permission.server";
import type { PointRow } from "@/lib/product-points";

export async function productPointsContext(write = false) {
  const employee = await requireEmployee();
  if (!employee) throw new Error("権限がありません。");
  const { viewer } = await viewPermissionContext();
  if (!await canView("soil-product-points", "", viewer)) throw new Error("閲覧権限がありません。");
  const canWrite = viewer.role === "super_admin";
  if (write && !canWrite) throw new Error("変更できるのは全権管理者です。");
  return { db: getSupabaseAdmin(), employee, canWrite };
}

export async function loadPoints(
  db: ReturnType<typeof getSupabaseAdmin>,
): Promise<PointRow[]> {
  const rows: PointRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db
      .from("soil_product_points")
      .select("*")
      .order("sort_order")
      .order("product")
      .order("channel")
      .order("start_date")
      .order("id")
      .range(offset, offset + 499);
    if (error)
      throw new Error(
        "付与ポイント表を読み込めませんでした。時間をおいて開き直してください。",
      );
    rows.push(...((data ?? []) as PointRow[]));
    if ((data?.length ?? 0) < 500) return rows;
  }
}
