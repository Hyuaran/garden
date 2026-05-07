/**
 * T-F10-02: fetchHankanhi / fetchHankanhiBatch のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f10-02-fetch-hankanhi.md §5 Step 3
 *
 * Supabase クライアントは `createSupabaseFromMock` で差し替え、
 * (company_id, ki) での SELECT が正しく組まれることと、
 * 正常 / 該当なし / エラー / 入力検証の分岐を検証する。
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";

import { createSupabaseFromMock } from "@/test-utils/supabase-mock";

vi.mock("@/app/forest/_lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/app/forest/_lib/supabase";
import {
  fetchHankanhi,
  fetchHankanhiBatch,
} from "@/app/forest/_lib/queries";
import type { Hankanhi } from "@/app/forest/_lib/types";

const sampleHankanhi: Hankanhi = {
  id: "11111111-1111-1111-1111-111111111111",
  company_id: "hyuaran",
  fiscal_period_id: null,
  ki: 7,
  yakuin: 6_000_000,
  kyuyo: 3_335_358,
  settai: 4_042_193,
  kaigi: 1_128_464,
  ryohi: 5_170_944,
  hanbai: 101_738,
  chidai: 6_714_996,
  shiharai: 1_318_868,
  source: "csv",
  notes: null,
  created_at: "2026-04-24T00:00:00Z",
  updated_at: "2026-04-24T00:00:00Z",
};

describe("fetchHankanhi", () => {
  let chain: ReturnType<typeof createSupabaseFromMock>["chain"];
  let from: ReturnType<typeof createSupabaseFromMock>["from"];

  beforeEach(() => {
    vi.clearAllMocks();
    const m = createSupabaseFromMock();
    chain = m.chain;
    from = m.from;
    (supabase.from as unknown as Mock).mockImplementation(from);
  });

  it("returns Hankanhi object when the row exists", async () => {
    chain.maybeSingle.mockResolvedValue({
      data: sampleHankanhi,
      error: null,
    });

    const result = await fetchHankanhi("hyuaran", 7);

    expect(result).toEqual(sampleHankanhi);
    expect(from).toHaveBeenCalledWith("forest_hankanhi");
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.eq).toHaveBeenCalledWith("company_id", "hyuaran");
    expect(chain.eq).toHaveBeenCalledWith("ki", 7);
  });

  it("returns null when no row is found", async () => {
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchHankanhi("hyuaran", 999);

    expect(result).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    chain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table forest_hankanhi" },
    });

    await expect(fetchHankanhi("hyuaran", 7)).rejects.toThrow(
      /permission denied/,
    );
  });

  it("throws on empty companyId", async () => {
    await expect(fetchHankanhi("", 7)).rejects.toThrow(
      /companyId is required/,
    );
  });

  it("throws on ki = 0", async () => {
    await expect(fetchHankanhi("hyuaran", 0)).rejects.toThrow(
      /positive integer/,
    );
  });

  it("throws on negative ki", async () => {
    await expect(fetchHankanhi("hyuaran", -1)).rejects.toThrow(
      /positive integer/,
    );
  });

  it("throws on non-integer ki", async () => {
    await expect(fetchHankanhi("hyuaran", 7.5)).rejects.toThrow(
      /positive integer/,
    );
  });
});

describe("fetchHankanhiBatch", () => {
  let chain: ReturnType<typeof createSupabaseFromMock>["chain"];
  let from: ReturnType<typeof createSupabaseFromMock>["from"];

  beforeEach(() => {
    vi.clearAllMocks();
    const m = createSupabaseFromMock();
    chain = m.chain;
    from = m.from;
    (supabase.from as unknown as Mock).mockImplementation(from);
  });

  it("returns empty array when called with no requests", async () => {
    const result = await fetchHankanhiBatch([]);

    expect(result).toEqual([]);
    // Supabase に問い合わせないこと
    expect(from).not.toHaveBeenCalled();
  });

  it("returns matching rows filtered by (company_id, ki) pair", async () => {
    const row1: Hankanhi = { ...sampleHankanhi, ki: 7 };
    const row2: Hankanhi = {
      ...sampleHankanhi,
      id: "22222222-2222-2222-2222-222222222222",
      ki: 8,
    };
    const unwanted: Hankanhi = {
      ...sampleHankanhi,
      id: "33333333-3333-3333-3333-333333333333",
      ki: 9,
    };
    // in + gte + lte でざっくり取得 → クライアント側で (company_id, ki) に絞る
    chain.lte.mockResolvedValue({
      data: [row1, row2, unwanted],
      error: null,
    });

    const result = await fetchHankanhiBatch([
      { companyId: "hyuaran", ki: 7 },
      { companyId: "hyuaran", ki: 8 },
    ]);

    expect(result).toEqual([row1, row2]);
    expect(from).toHaveBeenCalledWith("forest_hankanhi");
    expect(chain.in).toHaveBeenCalledWith("company_id", ["hyuaran"]);
    expect(chain.gte).toHaveBeenCalledWith("ki", 7);
    expect(chain.lte).toHaveBeenCalledWith("ki", 8);
  });

  it("throws when Supabase returns an error", async () => {
    chain.lte.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    await expect(
      fetchHankanhiBatch([{ companyId: "hyuaran", ki: 7 }]),
    ).rejects.toThrow(/boom/);
  });
});
