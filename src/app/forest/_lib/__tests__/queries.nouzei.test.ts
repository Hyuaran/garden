/**
 * T-F4-02 / T-F11-01: fetchNouzeiCalendar / fetchNouzeiDetail /
 * createNouzeiFileSignedUrl のテスト。
 *
 * spec:
 *   - docs/specs/2026-04-24-forest-t-f4-02-tax-calendar.md §5 Step 2
 *   - docs/specs/2026-04-24-forest-t-f11-01-tax-detail-modal.md §5 Step 1
 *
 * Supabase クライアント (DB / Storage 両方) を vi.mock で差し替えて検証。
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
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

import { supabase } from "@/app/forest/_lib/supabase";
import {
  fetchNouzeiCalendar,
  fetchNouzeiDetail,
  createNouzeiFileSignedUrl,
} from "@/app/forest/_lib/queries";
import type {
  NouzeiScheduleDetail,
  NouzeiScheduleWithItems,
} from "@/app/forest/_lib/types";

const sampleScheduleBase = {
  id: "sched-1",
  company_id: "hyuaran",
  kind: "yotei" as const,
  label: "予定",
  year: 2026,
  month: 11,
  due_date: "2026-11-30",
  total_amount: 2_324_000,
  status: "pending" as const,
  paid_at: null,
  notes: null,
  created_at: "2026-04-01T00:00:00Z",
  updated_at: "2026-04-01T00:00:00Z",
};

/**
 * fetchNouzeiCalendar は `.order().order().order()` の 3 連続呼出で終端。
 * chain.order の既定は chain を返すが、3 回目の呼出のみ resolve させる。
 */
function setupCalendarOrderResult(
  chain: ReturnType<typeof createSupabaseChain>,
  result: { data: unknown; error: { message: string } | null },
) {
  chain.order
    .mockReturnValueOnce(chain)
    .mockReturnValueOnce(chain)
    .mockResolvedValueOnce(result);
}

describe("fetchNouzeiCalendar", () => {
  let chain: ReturnType<typeof createSupabaseChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = createSupabaseChain();
    (supabase.from as unknown as Mock).mockReturnValue(chain);
  });

  it("returns schedules within the (from, to) month range", async () => {
    const within: NouzeiScheduleWithItems = {
      ...sampleScheduleBase,
      id: "within",
      year: 2026,
      month: 5,
      items: [],
    };
    const beforeFrom: NouzeiScheduleWithItems = {
      ...sampleScheduleBase,
      id: "before",
      year: 2026,
      month: 1,
      items: [],
    };
    const afterTo: NouzeiScheduleWithItems = {
      ...sampleScheduleBase,
      id: "after",
      year: 2026,
      month: 8,
      items: [],
    };
    setupCalendarOrderResult(chain, {
      data: [beforeFrom, within, afterTo],
      error: null,
    });

    const result = await fetchNouzeiCalendar(
      { y: 2026, m: 3 },
      { y: 2026, m: 7 },
    );

    expect(result.map((r) => r.id)).toEqual(["within"]);
    expect(supabase.from).toHaveBeenCalledWith("forest_nouzei_schedules");
    expect(chain.gte).toHaveBeenCalledWith("year", 2026);
    expect(chain.lte).toHaveBeenCalledWith("year", 2026);
  });

  it("returns empty array when supabase returns no rows", async () => {
    setupCalendarOrderResult(chain, { data: [], error: null });

    const result = await fetchNouzeiCalendar(
      { y: 2026, m: 1 },
      { y: 2026, m: 12 },
    );

    expect(result).toEqual([]);
  });

  it("throws when supabase returns an error", async () => {
    setupCalendarOrderResult(chain, {
      data: null,
      error: { message: "permission denied" },
    });

    await expect(
      fetchNouzeiCalendar({ y: 2026, m: 1 }, { y: 2026, m: 12 }),
    ).rejects.toThrow(/permission denied/);
  });

  it("includes schedules spanning year boundary", async () => {
    const dec2025: NouzeiScheduleWithItems = {
      ...sampleScheduleBase,
      id: "dec",
      year: 2025,
      month: 12,
      items: [],
    };
    const jan2026: NouzeiScheduleWithItems = {
      ...sampleScheduleBase,
      id: "jan",
      year: 2026,
      month: 1,
      items: [],
    };
    setupCalendarOrderResult(chain, {
      data: [dec2025, jan2026],
      error: null,
    });

    const result = await fetchNouzeiCalendar(
      { y: 2025, m: 11 },
      { y: 2026, m: 3 },
    );

    expect(result.map((r) => r.id).sort()).toEqual(["dec", "jan"]);
  });
});

describe("fetchNouzeiDetail", () => {
  let chain: ReturnType<typeof createSupabaseChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = createSupabaseChain();
    (supabase.from as unknown as Mock).mockReturnValue(chain);
  });

  it("returns detail with items sorted by sort_order and files by uploaded_at desc", async () => {
    const detail: NouzeiScheduleDetail = {
      ...sampleScheduleBase,
      items: [
        {
          id: "i2",
          schedule_id: "sched-1",
          label: "消費税等",
          amount: 1_432_400,
          sort_order: 2,
          created_at: "2026-04-01T00:00:00Z",
        },
        {
          id: "i1",
          schedule_id: "sched-1",
          label: "法人税等",
          amount: 891_600,
          sort_order: 1,
          created_at: "2026-04-01T00:00:00Z",
        },
      ],
      files: [
        {
          id: "f1",
          schedule_id: "sched-1",
          doc_name: "old.pdf",
          storage_path: "path/old",
          uploaded_by: null,
          uploaded_at: "2026-04-01T00:00:00Z",
        },
        {
          id: "f2",
          schedule_id: "sched-1",
          doc_name: "new.pdf",
          storage_path: "path/new",
          uploaded_by: null,
          uploaded_at: "2026-04-25T00:00:00Z",
        },
      ],
    };
    chain.maybeSingle.mockResolvedValueOnce({
      data: detail,
      error: null,
    });

    const result = await fetchNouzeiDetail("sched-1");

    expect(result?.items.map((i) => i.id)).toEqual(["i1", "i2"]);
    expect(result?.files.map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(supabase.from).toHaveBeenCalledWith("forest_nouzei_schedules");
    expect(chain.eq).toHaveBeenCalledWith("id", "sched-1");
  });

  it("returns null when no row is found", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    expect(await fetchNouzeiDetail("missing-id")).toBeNull();
  });

  it("throws on supabase error", async () => {
    chain.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });

    await expect(fetchNouzeiDetail("x")).rejects.toThrow(/boom/);
  });

  it("normalizes missing items / files arrays to []", async () => {
    chain.maybeSingle.mockResolvedValueOnce({
      data: {
        ...sampleScheduleBase,
        items: null,
        files: null,
      },
      error: null,
    });

    const result = await fetchNouzeiDetail("sched-1");
    expect(result?.items).toEqual([]);
    expect(result?.files).toEqual([]);
  });
});

describe("createNouzeiFileSignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the signed URL from supabase storage", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed?token=abc" },
      error: null,
    });
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl,
    });

    const url = await createNouzeiFileSignedUrl(
      "tax/2026/file.pdf",
      3600,
    );

    expect(url).toBe("https://example.test/signed?token=abc");
    expect(supabase.storage.from).toHaveBeenCalledWith("forest-tax");
    expect(createSignedUrl).toHaveBeenCalledWith("tax/2026/file.pdf", 3600);
  });

  it("uses default expiresInSec when omitted", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "x" },
      error: null,
    });
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl,
    });

    await createNouzeiFileSignedUrl("p");

    expect(createSignedUrl).toHaveBeenCalledWith("p", 3600);
  });

  it("throws on supabase storage error", async () => {
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "denied" },
      }),
    });

    await expect(createNouzeiFileSignedUrl("p")).rejects.toThrow(/denied/);
  });
});
