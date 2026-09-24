import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyUploadInBatches: vi.fn(),
  createServerClient: vi.fn(),
  forEachPgBatch: vi.fn(),
  getAdmin: vi.fn(),
  queryPg: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));
vi.mock("@/lib/db/pg", () => ({
  forEachPgBatch: (...args: unknown[]) => mocks.forEachPgBatch(...args),
  queryPg: (...args: unknown[]) => mocks.queryPg(...args),
}));
vi.mock("../uploads/_lib/apply-upload", async (importOriginal) => {
  const original = await importOriginal<typeof import("../uploads/_lib/apply-upload")>();
  return {
    ...original,
    applyUploadInBatches: (...args: unknown[]) => mocks.applyUploadInBatches(...args),
  };
});

import { POST } from "./route";

function serverClient() {
  return { auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } };
}

function adminClient() {
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; values: Record<string, unknown> }> = [];
  return {
    inserts,
    updates,
    rpc,
    from(table: string) {
      if (table === "root_employees") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { name: "東海林 美琴", garden_role: "manager" }, error: null }),
        };
        return query;
      }
      if (table === "soil_list_upload") {
        return {
          insert: (values: Record<string, unknown>) => {
            inserts.push({ table, values });
            return { select: () => ({ single: async () => ({ data: { id: "upload-1" }, error: null }) }) };
          },
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updates.push({ table, values });
              return { error: null };
            },
          }),
        };
      }
      if (table === "soil_list_assignment") {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === "soil_list_export") {
        return {
          insert: async (values: Record<string, unknown>) => {
            inserts.push({ table, values });
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("/api/soil/list/export", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset().mockResolvedValue(serverClient());
    mocks.getAdmin.mockReset();
    mocks.queryPg.mockReset()
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ phoneNumber: "0247542485" }] });
    mocks.forEachPgBatch.mockReset().mockImplementation(async (_text, _values, _batchSize, onBatch) => {
      await onBatch([]);
    });
    mocks.applyUploadInBatches.mockReset().mockResolvedValue({
      assignments: 1,
      assignments_new: 1,
      assignments_updated: 0,
      parent_updated: 1,
      parent_inserted: 0,
      parent_kept: 0,
      skipped: 0,
      remaining: 0,
      purchase_inserted: 0,
      line_type_set: 0,
      category_set: 0,
    });
  });

  it("records FileMaker export assignments without refreshing list options", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);

    const response = await POST(new Request("http://test/api/soil/list/export", {
      method: "POST",
      body: JSON.stringify({
        condition: { filters: [{ field: "phoneNumber", op: "eq", value: "0247542485" }] },
        columns: ["phoneNumber"],
        format: "fm_import",
        listName: "【光回線】フレッツ_20260925",
        listLoadedOn: "2026-09-25",
        recordAssignment: true,
      }),
    }));

    expect(response.status).toBe(200);
    expect(client.rpc.mock.calls.some((call) => (call as unknown[])[0] === "soil_list_refresh_options")).toBe(false);
    expect(client.updates.at(-1)?.values).toMatchObject({ status: "done", result: { assignments: 1 } });
    expect((client.updates.at(-1)?.values.result as Record<string, unknown>).warning).toBeUndefined();
  });
});
