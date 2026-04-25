/**
 * Vitest 導入スモークテスト。
 *
 * 目的:
 *   1. Vitest が動作する
 *   2. jsdom 環境が有効
 *   3. `@/` path alias が解決できる
 *   4. Supabase client のモックが `vi.mock` + `createSupabaseFromMock` で機能する
 *
 * 既存の `fetchCompanies` を題材にするが、これは T-F10 本実装のテストでは
 * ない（TDD の RED-GREEN 対象外）。実装は既にあり、ここではテスト基盤の
 * 疎通確認のみ。
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

import { createSupabaseFromMock } from "@/test-utils/supabase-mock";

vi.mock("@/app/forest/_lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/app/forest/_lib/supabase";
import { fetchCompanies } from "@/app/forest/_lib/queries";

describe("Vitest setup smoke test (fetchCompanies)", () => {
  let chain: ReturnType<typeof createSupabaseFromMock>["chain"];

  beforeEach(() => {
    vi.clearAllMocks();
    const m = createSupabaseFromMock();
    chain = m.chain;
    (supabase.from as unknown as Mock).mockImplementation(m.from);
  });

  it("returns company list resolved from Supabase", async () => {
    const mockCompanies = [
      {
        id: "hyuaran",
        name: "株式会社ヒュアラン",
        short: "ヒュアラン",
        kessan: "3",
        color: "#1e3a8a",
        light: "#bfdbfe",
        sort_order: 1,
      },
    ];
    // `.from('companies').select('*').order('sort_order')` の終端は order()
    chain.order.mockResolvedValue({ data: mockCompanies, error: null });

    const result = await fetchCompanies();

    expect(result).toEqual(mockCompanies);
    expect(supabase.from).toHaveBeenCalledWith("companies");
  });

  it("throws when Supabase returns error", async () => {
    chain.order.mockResolvedValue({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(fetchCompanies()).rejects.toThrow(/permission denied/);
  });
});
