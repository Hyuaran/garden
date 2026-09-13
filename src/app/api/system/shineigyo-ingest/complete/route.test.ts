import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyBearerRequest: (...args: unknown[]) => mocks.verify(...args) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { POST } from "./route";

const runId = "123e4567-e89b-42d3-a456-426614174000";
const request = (total: number) => new Request("http://localhost/api/system/shineigyo-ingest/complete", {
  method: "POST",
  headers: { authorization: "Bearer test", "content-type": "application/json" },
  body: JSON.stringify({ runId, total }),
});

function admin(actual: number) {
  const deletes: unknown[] = [];
  const logUpserts: unknown[] = [];
  return {
    deletes,
    logUpserts,
    from(table: string) {
      if (table === "system_fm_shineigyo") return {
        select: () => ({ eq: async () => ({ count: actual, error: null }) }),
        delete: () => ({ neq: async (column: string, value: string) => {
          deletes.push({ column, value });
          return { error: null };
        } }),
      };
      if (table === "system_fm_shineigyo_sync_log") return {
        async upsert(payload: unknown) {
          logUpserts.push(payload);
          return { error: null };
        },
      };
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("POST /api/system/shineigyo-ingest/complete", () => {
  beforeEach(() => {
    mocks.verify.mockReset().mockReturnValue({ ok: true });
    mocks.getAdmin.mockReset();
  });

  it("deletes rows from older runs when the received count matches total", async () => {
    const client = admin(2);
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request(2));
    expect(response.status).toBe(200);
    expect(client.deletes).toEqual([{ column: "run_id", value: runId }]);
    expect(client.logUpserts.at(-1)).toEqual(expect.objectContaining({ run_id: runId, status: "success", total_rows: 2 }));
  });

  it("does not delete rows when the count mismatches total", async () => {
    const client = admin(1);
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(request(2));
    expect(response.status).toBe(409);
    expect(client.deletes).toEqual([]);
    expect(client.logUpserts.at(-1)).toEqual(expect.objectContaining({ run_id: runId, status: "count_mismatch", total_rows: 1 }));
  });
});
