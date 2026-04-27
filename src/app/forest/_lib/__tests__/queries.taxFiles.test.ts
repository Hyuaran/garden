/**
 * T-F5-01: fetchTaxFiles / createTaxFileSignedUrl のユニットテスト。
 *
 * spec: docs/specs/2026-04-24-forest-t-f5-01-tax-files-infrastructure.md §5 Step 3
 *
 * Supabase クライアント（Table と Storage）を vi.mock で差し替えて検証。
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
  fetchTaxFiles,
  createTaxFileSignedUrl,
} from "@/app/forest/_lib/queries";
import type { TaxFile } from "@/app/forest/_lib/types";

const sample: TaxFile = {
  id: "11111111-1111-1111-1111-111111111111",
  company_id: "hyuaran",
  doc_name: "2024年度 確定申告書",
  file_name: "2024_kakutei.pdf",
  storage_path: "hyuaran/2024_kakutei.pdf",
  status: "kakutei",
  doc_date: "2024-03-31",
  uploaded_at: "2026-04-25T00:00:00Z",
  uploaded_by: null,
  note: null,
  mime_type: "application/pdf",
  file_size_bytes: 123_456,
  created_at: "2026-04-25T00:00:00Z",
  updated_at: "2026-04-25T00:00:00Z",
};

describe("fetchTaxFiles", () => {
  let chain: ReturnType<typeof createSupabaseChain>;

  beforeEach(() => {
    vi.clearAllMocks();
    chain = createSupabaseChain();
    (supabase.from as unknown as Mock).mockReturnValue(chain);
  });

  it("fetches all tax files when companyId is omitted (uploaded_at desc)", async () => {
    const rows: TaxFile[] = [sample];
    chain.order.mockResolvedValueOnce({ data: rows, error: null });

    const result = await fetchTaxFiles();

    expect(result).toEqual(rows);
    expect(supabase.from).toHaveBeenCalledWith("forest_tax_files");
    expect(chain.select).toHaveBeenCalledWith("*");
    expect(chain.order).toHaveBeenCalledWith("uploaded_at", {
      ascending: false,
    });
    // companyId を渡さない場合 .eq は呼ばれない
    expect(chain.eq).not.toHaveBeenCalled();
  });

  it("filters by companyId when provided", async () => {
    chain.order.mockResolvedValueOnce({ data: [sample], error: null });

    await fetchTaxFiles("hyuaran");

    expect(chain.eq).toHaveBeenCalledWith("company_id", "hyuaran");
  });

  it("returns empty array when supabase returns no rows", async () => {
    chain.order.mockResolvedValueOnce({ data: [], error: null });

    expect(await fetchTaxFiles()).toEqual([]);
  });

  it("returns empty array when supabase returns null data", async () => {
    chain.order.mockResolvedValueOnce({ data: null, error: null });

    expect(await fetchTaxFiles()).toEqual([]);
  });

  it("throws when supabase returns an error", async () => {
    chain.order.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    await expect(fetchTaxFiles()).rejects.toThrow(/permission denied/);
  });
});

describe("createTaxFileSignedUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the signed URL from supabase storage (default 600s)", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/tax/signed?t=abc" },
      error: null,
    });
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl,
    });

    const url = await createTaxFileSignedUrl("hyuaran/2024_kakutei.pdf");

    expect(url).toBe("https://example.test/tax/signed?t=abc");
    expect(supabase.storage.from).toHaveBeenCalledWith("forest-tax");
    expect(createSignedUrl).toHaveBeenCalledWith(
      "hyuaran/2024_kakutei.pdf",
      600,
    );
  });

  it("supports custom expiresInSec", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "x" },
      error: null,
    });
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl,
    });

    await createTaxFileSignedUrl("p", 60);

    expect(createSignedUrl).toHaveBeenCalledWith("p", 60);
  });

  it("throws on supabase storage error", async () => {
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "not found" },
      }),
    });

    await expect(createTaxFileSignedUrl("p")).rejects.toThrow(/not found/);
  });

  it("throws when signedUrl is empty", async () => {
    (supabase.storage.from as unknown as Mock).mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: "" },
        error: null,
      }),
    });

    await expect(createTaxFileSignedUrl("p")).rejects.toThrow(
      /empty signedUrl/,
    );
  });
});
