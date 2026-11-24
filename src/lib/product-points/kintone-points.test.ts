import { describe, expect, it } from "vitest";
import type { PointRow } from "./index";
import { parseKintonePointQuery, resolveKintonePoints } from "./kintone-points";

const row: PointRow = {
  id: "test", category: "kaisen", report_group: "collab", toss_points: 0,
  closer_points: 0, unit_price: null, has_option: null, sort_order: 0,
  note: null, updated_at: "2026-11-20T00:00:00Z", updated_by: null,
  product: "商材A", kintone_names: ["別名"], channel: "lp",
  start_date: "2026-11-01", end_date: "2026-11-20", total_points: 0,
};
const input = { product: "別名", master: "商材B", business: "自社", list: "WEB_広告", date: "2026-11-20" };

describe("Kintone の付与件数", () => {
  it("別名・獲得方法・終了日で一致し、ゼロも返す", () => {
    const master = { ...row, product: "商材B", total_points: 2, kintone_names: [] };
    expect(resolveKintonePoints([master, row], input))
      .toEqual({ points: 0, toss: 0, product: "商材A", channel: "lp" });
  });

  it("第一候補が空または期間外なら商材マスタを確認する", () => {
    const master = { ...row, product: "商材B", start_date: "2026-11-21", end_date: null, total_points: 2 };
    for (const product of ["", "別名"]) {
      expect(resolveKintonePoints([row, master], { ...input, product, date: "2026-11-21" }))
        .toEqual({ points: 2, toss: 0, product: "商材B", channel: "lp" });
    }
  });

  it("該当しない場合は入力値を応答に含めない", () => {
    expect(resolveKintonePoints([row], { ...input, business: "不明" }))
      .toEqual({ points: null, toss: null, product: null, channel: null });
  });

  it("マスタのみ、空のリスト名を受け付ける", () => {
    expect(parseKintonePointQuery(new URLSearchParams({ master: " 商材A ", date: "2026-11-20" })))
      .toEqual({ product: "", master: "商材A", business: "", list: "", date: "2026-11-20" });
  });

  it.each([
    "product=A&date=2026-02-30",
    "product=A&product=B&date=2026-11-20",
    "product=A&date=2026-11-20&name=someone",
    "product=A%00&date=2026-11-20",
    "date=2026-11-20",
  ])("不正なクエリを拒否する %s", (query) => {
    expect(parseKintonePointQuery(new URLSearchParams(query))).toBeNull();
  });
});
