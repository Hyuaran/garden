/**
 * T-F2-01 / fetchLastUpdated のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f2-01-last-updated.md §5 Step 1
 *
 * fiscal_periods と shinkouki それぞれの updated_at 最大値を Promise.all で取得し、
 * より新しい方を LastUpdatedAt として返す。両方空の場合は epoch 0 で fallback。
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  type Mock,
} from "vitest";

import { createSupabaseChain } from "@/test-utils/supabase-mock";

vi.mock("@/app/forest/_lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "@/app/forest/_lib/supabase";
import { fetchLastUpdated } from "@/app/forest/_lib/queries";

/**
 * `supabase.from('fiscal_periods' | 'shinkouki')` それぞれ別の chain を返すセットアップ。
 * maybeSingle 終端で data/error を制御できる。
 */
function setupFromMock() {
  const fpChain = createSupabaseChain();
  const skChain = createSupabaseChain();
  (supabase.from as unknown as Mock).mockImplementation((table: string) => {
    if (table === "fiscal_periods") return fpChain;
    if (table === "shinkouki") return skChain;
    throw new Error(`unexpected table: ${table}`);
  });
  return { fpChain, skChain };
}

describe("fetchLastUpdated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns fiscal_periods timestamp when it is more recent than shinkouki", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-25T10:00:00Z" },
      error: null,
    });
    skChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-20T10:00:00Z" },
      error: null,
    });

    const result = await fetchLastUpdated();

    expect(result.source).toBe("fiscal_periods");
    expect(result.at).toEqual(new Date("2026-04-25T10:00:00Z"));
  });

  it("returns shinkouki timestamp when it is more recent than fiscal_periods", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-10T10:00:00Z" },
      error: null,
    });
    skChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-25T10:00:00Z" },
      error: null,
    });

    const result = await fetchLastUpdated();

    expect(result.source).toBe("shinkouki");
    expect(result.at).toEqual(new Date("2026-04-25T10:00:00Z"));
  });

  it("returns 'both' when fiscal_periods and shinkouki have identical timestamps", async () => {
    const { fpChain, skChain } = setupFromMock();
    const ts = "2026-04-25T10:00:00Z";
    fpChain.maybeSingle.mockResolvedValue({
      data: { updated_at: ts },
      error: null,
    });
    skChain.maybeSingle.mockResolvedValue({
      data: { updated_at: ts },
      error: null,
    });

    const result = await fetchLastUpdated();

    // 同時刻ケースは fiscal_periods 側の >= 分岐が勝つので 'fiscal_periods' でも OK
    // spec §5 Step 1 では 'both' を期待
    expect(result.source).toBe("both");
    expect(result.at).toEqual(new Date(ts));
  });

  it("falls back to epoch 0 when both tables are empty", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    skChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchLastUpdated();

    expect(result.at.getTime()).toBe(0);
  });

  it("returns fiscal_periods source when only fiscal_periods has data", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-25T10:00:00Z" },
      error: null,
    });
    skChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await fetchLastUpdated();

    expect(result.source).toBe("fiscal_periods");
    expect(result.at).toEqual(new Date("2026-04-25T10:00:00Z"));
  });

  it("returns shinkouki source when only shinkouki has data", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    skChain.maybeSingle.mockResolvedValue({
      data: { updated_at: "2026-04-25T10:00:00Z" },
      error: null,
    });

    const result = await fetchLastUpdated();

    expect(result.source).toBe("shinkouki");
    expect(result.at).toEqual(new Date("2026-04-25T10:00:00Z"));
  });

  it("throws when fiscal_periods query returns an error", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "fp boom" },
    });
    skChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(fetchLastUpdated()).rejects.toThrow(/fp boom/);
  });

  it("throws when shinkouki query returns an error", async () => {
    const { fpChain, skChain } = setupFromMock();
    fpChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    skChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "sk boom" },
    });

    await expect(fetchLastUpdated()).rejects.toThrow(/sk boom/);
  });
});
