import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ employee: vi.fn(), query: vi.fn() }));

vi.mock("@/app/system/onboarding/_lib/onboarding.server", () => ({
  onboardingEmployee: mocks.employee,
  OnboardingError: class extends Error { constructor(message: string, public status = 500) { super(message); } },
}));

import { GET } from "./route";

type Operation = { method: string; args: unknown[] };

function supabaseMock() {
  return {
    from(table: string) {
      const ops: Operation[] = [];
      const builder = {
        select(...args: unknown[]) { ops.push({ method: "select", args }); return builder; },
        eq(...args: unknown[]) { ops.push({ method: "eq", args }); return builder; },
        or(...args: unknown[]) { ops.push({ method: "or", args }); return builder; },
        order(...args: unknown[]) { ops.push({ method: "order", args }); return builder; },
        limit(...args: unknown[]) { ops.push({ method: "limit", args }); return mocks.query(table, ops); },
      };
      return builder;
    },
  };
}

describe("入社手続きの支店検索API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.employee.mockResolvedValue({ supabase: supabaseMock() });
  });

  it("bankCode と code があると支店コードで1件引く", async () => {
    mocks.query.mockResolvedValue({ data: [{ branch_code: "135", branch_name: "渋谷" }], error: null });
    const response = await GET(new Request("https://garden.example/api/system/onboarding/lookup/branch?bankCode=0001&name=古い支店&code=135"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ branches: [{ branchCode: "135", branchName: "渋谷" }] });
    expect(mocks.query.mock.calls[0][1]).toEqual([
      { method: "select", args: ["branch_code,branch_name"] },
      { method: "eq", args: ["bank_code", "0001"] },
      { method: "eq", args: ["branch_code", "135"] },
      { method: "order", args: ["branch_code", { ascending: true }] },
      { method: "limit", args: [1] },
    ]);
  });

  it("支店名と読みを見て、支店を落とした候補を最大20件で探す", async () => {
    mocks.query
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ branch_code: "135", branch_name: "渋谷" }], error: null });
    const response = await GET(new Request("https://garden.example/api/system/onboarding/lookup/branch?bankCode=0001&name=渋谷支店"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ branches: [{ branchCode: "135", branchName: "渋谷" }] });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[1][1]).toContainEqual({ method: "or", args: ["branch_name.ilike.*渋谷*,branch_kana.ilike.*渋谷*"] });
    expect(mocks.query.mock.calls[1][1]).toContainEqual({ method: "limit", args: [20] });
  });
});
