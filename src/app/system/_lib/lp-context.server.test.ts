import { describe, expect, it, vi } from "vitest";
import { loadLpKintoneContext } from "./lp-context.server";
import { loadLpCustomerOrderCounts } from "./lp-kintone";
vi.mock("./lp-kintone", () => ({
  loadLpScope: vi.fn(async () => [{ bizCode: "hikari", bizName: "ヒカリのプロ", customerApp: 226, circuitIds: [], recordOrder: 1 }]),
  loadLpCustomerOrderCounts: vi.fn(),
  unmatchedLpOrders: new WeakMap(),
  lpCustomerAppTokenEnv: vi.fn(() => "TOKEN"),
  loadLpCustomerRecords: vi.fn(async () => []),
  countLpRegisteredRecords: vi.fn(() => ({ denominator: 0, preconfirmWaiting: 0, applications: 0, won: 0, excluded: 0 })),
  countLpApplications: vi.fn(() => new Map()),
}));
describe("LP context の顧客一覧受注", () => {
  it("受注の取得失敗を notes に伝え、LP登録集計は維持する", async () => {
    vi.mocked(loadLpCustomerOrderCounts).mockResolvedValue(null);
    const context = await loadLpKintoneContext("2026-10-16", "2026-10-17");
    expect(context.lpCustomerOrderCountsByBiz).toBeNull();
    expect(context.notes).toContain("顧客一覧（受注）を取得できませんでした");
    expect(context.lpRegisteredCountsByBiz.get("hikari")?.denominator).toBe(0);
  });
  it("受注件数と指定期間を引き継ぐ", async () => {
    vi.mocked(loadLpCustomerOrderCounts).mockResolvedValue(new Map([["hikari", 6]]));
    const context = await loadLpKintoneContext("2026-10-16", "2026-10-17");
    expect(context.lpCustomerOrderCountsByBiz?.get("hikari")).toBe(6);
    expect(loadLpCustomerOrderCounts).toHaveBeenLastCalledWith(context.lpScope, "2026-10-16", "2026-10-17");
    expect(context.notes).toEqual([]);
  });
});
