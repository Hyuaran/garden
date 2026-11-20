import { createRequire } from "node:module";
import { expect, it } from "vitest";

const { buildQuery, applyResult } = createRequire(import.meta.url)("./garden-fuyo-points.js") as {
  buildQuery: (record: Record<string, { value: string }>) => string | null;
  applyResult: (record: { 付与件数: { value: string } }, result: { points: number | null }, name: string) => string;
};

it("実績日を優先し、空の場合は受注日を使う", () => {
  const record = {
    商材名区分2: { value: "商材A" }, m_product: { value: "商材B" },
    事業名: { value: "自社" }, B_リスト名: { value: "WEB_広告" },
    実績日: { value: "2026-11-20" }, 受注日: { value: "2026-11-19" },
    付与件数: { value: "1" }, 顧客氏名: { value: "送信対象外" },
  };
  expect(Object.fromEntries(new URLSearchParams(buildQuery(record)!))).toEqual({
    product: "商材A", master: "商材B", business: "自社", list: "WEB_広告", date: "2026-11-20",
  });
  record.実績日.value = "";
  expect(new URLSearchParams(buildQuery(record)!).get("date")).toBe("2026-11-19");
});

it("該当なしは現在の値を維持し、ゼロは反映する", () => {
  const record = { 付与件数: { value: "1.3" } };
  expect(applyResult(record, { points: null }, "商材A"))
    .toBe("付与ポイント表に無い商材です（商材A）。Garden の付与ポイント表に追加してください。");
  expect(record.付与件数.value).toBe("1.3");
  expect(applyResult(record, { points: 0 }, "商材A")).toBe("");
  expect(record.付与件数.value).toBe("0");
});
