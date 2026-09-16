import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), insert: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({
  from: (table: string) => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => mocks.query(table) }) }) }) }),
    insert: (row: unknown) => mocks.insert(table, row),
  }),
}) }));

import { POST } from "./route";

describe("bank master import route", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "secret";
    mocks.query.mockResolvedValue({ data: { source_md5: "same-md5" }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.includes("updated_at") ? "20260824" : "same-md5", { status: 200 })));
  });

  it("md5 が同じなら skipped_same を書いて zip を取りに行かない", async () => {
    const response = await POST(new Request("https://garden.test/api/system/bank-master-import", { method: "POST", headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: "skipped_same" });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledWith("system_bank_datasets", expect.objectContaining({ status: "skipped_same" }));
  });
});
