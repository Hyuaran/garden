import { expect, it } from "vitest";
import type { PointRow } from "../../src/lib/product-points";
import { parseArgs, planRecord } from "./backfill";

const record = {
  "$id": { value: "1" }, "$revision": { value: "2" },
  商材名区分2: { value: "" }, m_product: { value: "商材A" }, 事業名: { value: "自社" },
  B_リスト名: { value: "" }, 実績日: { value: "2026-11-20" },
  受注日: { value: "2026-11-01" }, 付与件数: { value: "0.00" }, トス付与件数_Garden: { value: "0" },
};
const row: PointRow = {
  id: "test", category: "kaisen", report_group: "collab", toss_points: 0,
  closer_points: 0, unit_price: null, has_option: null, sort_order: 0,
  note: null, updated_at: "2026-11-20T00:00:00Z", updated_by: null,
  product: "商材A", kintone_names: [], channel: "hakuchi", total_points: 0,
  start_date: "2026-11-20", end_date: null,
};

it("日付の下限を要求し、明示したときだけ書き込みを選ぶ", () => {
  expect(parseArgs(["--from", "2026-11-20"])).toEqual({ from: "2026-11-20", apply: false });
  expect(parseArgs(["--apply", "--from", "2026-11-20"]).apply).toBe(true);
  expect(() => parseArgs(["--apply"])).toThrow();
  expect(() => parseArgs(["--from", "2026-11-31"])).toThrow();
});

it("数値が同じ場合や表に無い場合には更新せず、空欄にはゼロも反映する", () => {
  expect(planRecord(record, [row])).toMatchObject({ missing: false, update: null });
  expect(planRecord(record, [])).toMatchObject({ missing: true, update: null });
  expect(planRecord({ ...record, 付与件数: { value: "" } }, [row]).update).toEqual({
    id: "1", revision: "2", record: { 付与件数: { value: "0" } },
  });
  expect(planRecord({ ...record, トス付与件数_Garden: { value: "" } }, [row]).update).toEqual({
    id: "1", revision: "2", record: { トス付与件数_Garden: { value: "0" } },
  });
  expect(planRecord(record, [{ ...row, total_points: 1.5, toss_points: 0.2 }]).update).toEqual({
    id: "1", revision: "2", record: { 付与件数: { value: "1.5" }, トス付与件数_Garden: { value: "0.2" } },
  });
});
