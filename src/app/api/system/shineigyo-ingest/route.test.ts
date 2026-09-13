import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyBearerRequest: (...args: unknown[]) => mocks.verify(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { POST } from "./route";

const runId = "123e4567-e89b-42d3-a456-426614174000";
const validRow = { 主キー: "1001", 電話番号_ハイフンなし: "03-1234-5678", 既契約情報: "ドコモ光" };
const request = (rows: unknown[]) => new Request("http://localhost/api/system/shineigyo-ingest", {
  method: "POST",
  headers: { authorization: "Bearer test", "content-type": "application/json" },
  body: JSON.stringify({ runId, batchIndex: 0, rows }),
});

function admin() {
  const upserts: Array<{ table: string; payload: unknown; options: unknown }> = [];
  return {
    upserts,
    from(table: string) {
      if (table === "system_fm_shineigyo") return {
        async upsert(payload: unknown, options: unknown) {
          upserts.push({ table, payload, options });
          return { error: null };
        },
      };
      if (table === "system_fm_shineigyo_sync_log") return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { total_rows: 0 }, error: null }) }) }),
        async upsert(payload: unknown, options: unknown) {
          upserts.push({ table, payload, options });
          return { error: null };
        },
      };
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("POST /api/system/shineigyo-ingest", () => {
  beforeEach(() => {
    mocks.verify.mockReset().mockReturnValue({ ok: true });
    mocks.getAdmin.mockReset();
  });

  it("rejects unauthenticated requests before creating an admin client", async () => {
    mocks.verify.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const response = await POST(request([validRow]));
    expect(response.status).toBe(401);
    expect(mocks.getAdmin).not.toHaveBeenCalled();
  });

  it("upserts rows by FileMaker primary key and records the running total", async () => {
    const client = admin();
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request([validRow]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "success", records_upserted: 1 });
    expect(client.upserts[0]).toEqual({
      table: "system_fm_shineigyo",
      payload: [expect.objectContaining({ "主キー": "1001", "電話番号": "0312345678", "既契約情報": "ドコモ光", run_id: runId })],
      options: { onConflict: "主キー", ignoreDuplicates: false },
    });
    expect(client.upserts[1]).toEqual({
      table: "system_fm_shineigyo_sync_log",
      payload: expect.objectContaining({ run_id: runId, status: "running", total_rows: 1 }),
      options: { onConflict: "run_id", ignoreDuplicates: false },
    });
  });
});
