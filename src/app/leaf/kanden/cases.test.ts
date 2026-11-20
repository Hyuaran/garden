import { expect, it } from "vitest";
import { caseListHref, caseTab, fiscalYear } from "./cases";

it("年度は日本時間の4月1日から切り替わる", () => {
  expect(fiscalYear(new Date("2026-03-31T14:59:59Z"))).toBe(2025);
  expect(fiscalYear(new Date("2026-03-31T15:00:00Z"))).toBe(2026);
});

it("タブと年度をURLに含め、不正なタブは進行中を使う", () => {
  expect(caseTab("completed")).toBe("completed");
  expect(caseTab(["completed"])).toBe("active");
  const url = new URL(caseListHref(2024, "cancelled", "山田"), "https://example.test");
  expect(url.pathname).toBe("/leaf/kanden");
  expect(Object.fromEntries(url.searchParams)).toEqual({ year: "2024", tab: "cancelled", q: "山田" });
});
