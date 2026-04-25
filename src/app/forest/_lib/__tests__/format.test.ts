/**
 * T-F2-01 / format.ts: fmtDateJP の単体テスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f2-01-last-updated.md §5 Step 5
 * 既存 fmtYen / fmtYenShort も回帰防止で軽くカバー。
 */

import { describe, it, expect } from "vitest";

import { fmtDateJP, fmtYen, fmtYenShort } from "@/app/forest/_lib/format";

describe("fmtDateJP", () => {
  it("formats a regular date as YYYY年M月D日", () => {
    expect(fmtDateJP(new Date(2026, 3, 25))).toBe("2026年4月25日");
  });

  it("does not zero-pad single-digit month / day", () => {
    expect(fmtDateJP(new Date(2026, 0, 1))).toBe("2026年1月1日");
  });

  it("handles year-end boundary", () => {
    expect(fmtDateJP(new Date(2025, 11, 31))).toBe("2025年12月31日");
  });

  it("returns `―` for null input", () => {
    expect(fmtDateJP(null)).toBe("―");
  });

  it("returns `―` for epoch 0 (placeholder for missing data)", () => {
    expect(fmtDateJP(new Date(0))).toBe("―");
  });
});

describe("fmtYen (回帰防止)", () => {
  it("formats 1 億以上 as X.X億", () => {
    expect(fmtYen(150_000_000)).toBe("1.5億");
  });
  it("formats 1 万以上 as X万 (rounded)", () => {
    expect(fmtYen(50_000)).toBe("5万");
  });
  it("formats sub-万 as X円", () => {
    expect(fmtYen(800)).toBe("800円");
  });
  it("returns `―` for null", () => {
    expect(fmtYen(null)).toBe("―");
  });
});

describe("fmtYenShort (回帰防止)", () => {
  it("strips the 円 suffix for sub-万 values", () => {
    expect(fmtYenShort(800)).toBe("800");
  });
});
