import { expect, it } from "vitest";
import { FALLBACK_CORPS, sortCorps } from "./expenseCorpUtils";

it("orders corporations by establishment date before names or IDs", () => {
  expect(sortCorps([
    { id: "a", name_short: "あ", established_on: "2025-01-01" },
    { id: "z", name_short: "ん", established_on: "2000-01-01" },
    { id: "b", name_short: "い", established_on: null },
  ]).map(corp => corp.id)).toEqual(["z", "a", "b"]);
});

it("uses registration order for the fallback choices without dates", () => {
  expect(sortCorps([...FALLBACK_CORPS].reverse()).map(corp => corp.name_short)).toEqual([
    "ヒュアラン", "センターライズ", "ARATA", "リンクサポート", "たいよう", "壱", "ストーンベース",
  ]);
});
