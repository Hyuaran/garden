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

describe("入社手続きの銀行検索API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.employee.mockResolvedValue({ supabase: supabaseMock() });
  });

  it("code があると名前より優先して金融機関コードで1件引く", async () => {
    mocks.query.mockResolvedValue({ data: [{ bank_code: "0001", bank_name: "みずほ" }], error: null });
    const response = await GET(new Request("https://garden.example/api/system/onboarding/lookup/bank?name=古い名前&code=0001"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ banks: [{ bankCode: "0001", bankName: "みずほ" }] });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query.mock.calls[0][1]).toEqual([
      { method: "select", args: ["bank_code,bank_name"] },
      { method: "eq", args: ["bank_code", "0001"] },
      { method: "order", args: ["bank_code", { ascending: true }] },
      { method: "limit", args: [1] },
    ]);
  });

  it("名前と読みを見て、正規化した候補を順に最大20件で探す", async () => {
    mocks.query
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [{ bank_code: "0005", bank_name: "三菱ＵＦＪ" }], error: null });
    const response = await GET(new Request("https://garden.example/api/system/onboarding/lookup/bank?name=三菱UFJ銀行"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ banks: [{ bankCode: "0005", bankName: "三菱ＵＦＪ" }] });
    expect(mocks.query).toHaveBeenCalledTimes(3);
    expect(mocks.query.mock.calls[2][1]).toContainEqual({ method: "or", args: ["bank_name.ilike.*三菱ＵＦＪ*,bank_kana.ilike.*三菱ＵＦＪ*"] });
    expect(mocks.query.mock.calls[2][1]).toContainEqual({ method: "limit", args: [20] });
  });
});
