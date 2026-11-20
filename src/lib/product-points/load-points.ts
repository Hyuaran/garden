import type { SupabaseClient } from "@supabase/supabase-js";
import type { PointRow } from "./index";

export async function loadPoints(
  db: SupabaseClient,
  signal?: AbortSignal,
): Promise<PointRow[]> {
  const rows: PointRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const query = db
      .from("soil_product_points")
      .select("*")
      .order("sort_order")
      .order("product")
      .order("channel")
      .order("start_date")
      .order("id")
      .range(offset, offset + 499);
    const { data, error } = await (signal ? query.abortSignal(signal) : query);
    if (error)
      throw new Error(
        "付与ポイント表を読み込めませんでした。時間をおいて開き直してください。",
      );
    rows.push(...((data ?? []) as PointRow[]));
    if ((data?.length ?? 0) < 500) return rows;
  }
}
