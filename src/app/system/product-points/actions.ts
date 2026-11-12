"use server";

import {
  overlapping,
  splitPeriod,
  validateRow,
  type PointRow,
} from "@/lib/product-points";
import { loadPoints, productPointsContext } from "./server";

export async function savePoint(
  row: PointRow,
  sourceId: string | null,
  expected: string | null,
  split: boolean,
) {
  try {
    const { db, employee } = await productPointsContext(true);
    if (!row || typeof row !== "object")
      return { error: "入力内容を確認してください。" };
    const validation = validateRow(row);
    if (validation) return { error: validation };
    const rows = await loadPoints(db);
    const source = sourceId
      ? rows.find((item) => item.id === sourceId)
      : undefined;
    if (sourceId && (!source || source.updated_at !== expected))
      return {
        error: "別の変更が保存されています。画面を開き直してください。",
      };
    let conflict: PointRow | undefined;
    if (split && source) {
      splitPeriod(rows, source, row);
    } else {
      conflict = overlapping(rows, { ...row, id: sourceId ?? "" });
    }
    if (conflict)
      return {
        error: `同じ商材・獲得方法で期間が重なっています（${conflict.start_date}〜${conflict.end_date ?? ""}）`,
      };
    const { data, error } = await db.rpc("soil_product_points_save", {
      p_row: row,
      p_actor: employee.userId,
      p_source_id: sourceId,
      p_expected_updated_at: expected,
      p_split: split,
    });
    if (error) {
      if (error.code === "23P01") {
        const latest = await loadPoints(db);
        const conflict = overlapping(
          latest.filter((item) => !split || item.id !== sourceId),
          { ...row, id: sourceId ?? "" },
        );
        return {
          error: conflict
            ? `同じ商材・獲得方法で期間が重なっています（${conflict.start_date}〜${conflict.end_date ?? ""}）`
            : "同じ商材・獲得方法で期間が重なっています。画面を開き直して期間を確認してください。",
        };
      }
      if (error.code === "40001")
        return {
          error: "別の変更が保存されています。画面を開き直してください。",
        };
      return {
        error:
          "保存できませんでした。入力内容を確認して、もう一度保存してください。",
      };
    }
    return { rows: data as PointRow[] };
  } catch (error) {
    return {
      error:
        error instanceof Error &&
        /^(権限が|変更できるのは|付与ポイント表を|新しい開始日は|同じ商材・獲得方法で)/.test(
          error.message,
        )
          ? error.message
          : "保存できませんでした。もう一度お試しください。",
    };
  }
}
