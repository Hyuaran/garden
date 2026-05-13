import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchForestMonthlyRevenue, buildMockForestData } from "../forest-fetcher";

describe("buildMockForestData", () => {
  it("直近 6 ヶ月分の mock データを 2 法人分返す", () => {
    const data = buildMockForestData();
    expect(data.source).toBe("mock");
    expect(data.monthly_revenues).toHaveLength(12); // 2 法人 × 6 ヶ月
    const corpIds = new Set(data.monthly_revenues.map((r) => r.corporation_id));
    expect(corpIds.size).toBe(2);
  });

  it("各 month 値は YYYY-MM 形式", () => {
    const data = buildMockForestData();
    for (const r of data.monthly_revenues) {
      expect(r.year_month).toMatch(/^\d{4}-\d{2}$/);
    }
  });

  it("revenue は正の整数", () => {
    const data = buildMockForestData();
    for (const r of data.monthly_revenues) {
      expect(r.revenue).toBeGreaterThan(0);
      expect(Number.isInteger(r.revenue)).toBe(true);
    }
  });
});

describe("fetchForestMonthlyRevenue (dev mode)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("dev mode では mock データを返す", async () => {
    const data = await fetchForestMonthlyRevenue();
    expect(data.source).toBe("mock");
    expect(data.monthly_revenues.length).toBeGreaterThan(0);
  });
});
