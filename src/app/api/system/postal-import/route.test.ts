import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insertDataset: vi.fn(), insertRows: vi.fn(), rpc: vi.fn(), remove: vi.fn() }));
vi.mock("./_lib", () => ({
  JAPAN_POST_UTF8_URL: "https://example.test/postal.zip",
  extractJapanPostCsv: vi.fn().mockResolvedValue("csv"),
  parseJapanPostCsv: vi.fn(() => Array.from({ length: 100_001 }, (_, index) => ({ postal_code: String(index).padStart(7, "0"), prefecture: "都", city: "市", town: "町", prefecture_kana: "ト", city_kana: "シ", town_kana: "マチ", is_special: false }))),
  postalSourceDate: vi.fn(() => "2026-08-01"),
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => table === "system_postal_datasets"
    ? { insert: () => ({ select: () => ({ single: mocks.insertDataset }) }), delete: () => ({ eq: mocks.remove }) }
    : { insert: mocks.insertRows },
  rpc: mocks.rpc,
}) }));
import { POST } from "./route";

describe("manual postal import", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), { status: 200, headers: { "last-modified": "2026-08-25" } })));
    mocks.insertDataset.mockResolvedValue({ data: { id: "dataset-1" }, error: null });
    mocks.insertRows.mockResolvedValue({ error: null }); mocks.rpc.mockResolvedValue({ error: null }); mocks.remove.mockResolvedValue({ error: null });
  });
  it("loads all rows before activating the new dated dataset", async () => {
    const response = await POST(new Request("http://x/api/system/postal-import", { method: "POST", headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ ok: true, count: 100_001, sourceDate: "2026-08-01" });
    expect(mocks.insertRows).toHaveBeenCalledTimes(101);
    expect(mocks.rpc).toHaveBeenCalledWith("activate_system_postal_dataset", { p_dataset_id: "dataset-1", p_row_count: 100_001 });
  });
});
