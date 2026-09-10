import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { POST as APPLY_POST } from "./[id]/apply/route";
import { POST } from "./route";

function serverClient(userId: string | null = "user-1") {
  return { auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) } };
}

function csv(rowCount: number) {
  const header = "リスト名,既契約者名_姓,既契約者名_名,設置先_住所_都道府県,設置先_住所_市町村,設置先_住所_町域,電話番号_ハイフンなし,設置先_郵便番号";
  const rows = Array.from({ length: rowCount }, (_, index) => `リスト_20260907,姓${index},名${index},大阪府,大阪市,北区,06${String(index).padStart(8, "0")},5300001`);
  return `${header}\n${rows.join("\n")}\n`;
}

function requestWithFile(body: string) {
  const form = new FormData();
  form.set("file", new File([body], "list.csv", { type: "text/csv" }));
  return { formData: async () => form } as Request;
}

function applyRow(assignments: number, remaining: number) {
  return { assignments, assignments_new: assignments, assignments_updated: 0, parent_updated: assignments, parent_inserted: 0, parent_kept: 0, skipped: 0, remaining };
}

function adminClient(
  role = "manager",
  options: {
    rpcResults?: Array<{ data: unknown; error: { message: string } | null }>;
    upload?: { id: string; status: "processing" | "done" | "failed"; row_count: number; result: Record<string, unknown> | null } | null;
  } = {},
) {
  const upserts: unknown[][] = [];
  const updates: Array<{ table: string; values: Record<string, unknown>; column: string; value: unknown }> = [];
  const rpcResults = options.rpcResults ?? [{
    data: [{ assignments: 1001, assignments_new: 1001, assignments_updated: 0, parent_updated: 999, parent_inserted: 2, parent_kept: 0, skipped: 0, remaining: 0 }],
    error: null,
  }];
  const rpc = vi.fn(async (name: string) => {
    if (name !== "soil_list_apply_upload") return { data: null, error: null };
    return rpcResults.shift() ?? { data: [applyRow(0, 0)], error: null };
  });
  return {
    upserts,
    updates,
    rpc,
    from(table: string) {
      if (table === "root_employees") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({ data: { name: "東海林 美琴", garden_role: role }, error: null }),
        };
        return query;
      }
      if (table === "soil_list_upload") {
        return {
          insert: () => ({ select: () => ({ single: async () => ({ data: { id: "upload-1" }, error: null }) }) }),
          update: (values: Record<string, unknown>) => ({
            eq: async (column: string, value: unknown) => {
              updates.push({ table, values, column, value });
              return { error: null };
            },
          }),
          select: () => {
            const query = {
              order: () => ({ limit: async () => ({ data: [], error: null }) }),
              eq: () => ({
                maybeSingle: async () => ({
                  data: options.upload === undefined ? { id: "upload-1", status: "failed", row_count: 2500, result: applyRow(1000, 1500) } : options.upload,
                  error: null,
                }),
              }),
            };
            return query;
          },
        };
      }
      if (table === "soil_list_assignment") {
        return {
          upsert: async (values: unknown[]) => {
            upserts.push(values);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("/api/soil/list/uploads", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset().mockResolvedValue(serverClient());
    mocks.getAdmin.mockReset();
  });

  it("returns 403 below manager", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("staff"));
    const response = await POST(requestWithFile(csv(1)));
    expect(response.status).toBe(403);
  });

  it("imports assignments in 1,000 row chunks and applies the upload until no rows remain", async () => {
    const client = adminClient("manager", {
      rpcResults: [
        { data: [applyRow(1000, 1500)], error: null },
        { data: [applyRow(1000, 500)], error: null },
        { data: [applyRow(500, 0)], error: null },
      ],
    });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(requestWithFile(csv(2500)));
    expect(response.status).toBe(200);
    expect(client.upserts.map((chunk) => chunk.length)).toEqual([1000, 1000, 500]);
    expect(client.rpc).toHaveBeenNthCalledWith(1, "soil_list_apply_upload", { p_upload_id: "upload-1", p_limit: 1000 });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "soil_list_apply_upload", { p_upload_id: "upload-1", p_limit: 1000 });
    expect(client.rpc).toHaveBeenNthCalledWith(3, "soil_list_apply_upload", { p_upload_id: "upload-1", p_limit: 1000 });
    expect(client.updates.at(-1)?.values).toMatchObject({ status: "done", result: { assignments: 2500, parent_updated: 2500, remaining: 0 } });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { assignments: 2500, parent_updated: 2500, remaining: 0 },
    });
  });

  it("stores partial results and returns ok false when applying stops midway", async () => {
    const client = adminClient("manager", {
      rpcResults: [
        { data: [applyRow(1000, 1500)], error: null },
        { data: null, error: { message: "statement timeout" } },
      ],
    });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(requestWithFile(csv(2500)));
    expect(response.status).toBe(200);
    expect(client.updates.at(-1)?.values).toMatchObject({ status: "failed", result: { assignments: 1000, remaining: 1500 } });
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      result: { assignments: 1000, remaining: 1500 },
      error: "途中で止まりました（親へ反映 1,000 / 2,500）。記録から「反映をやり直す」を押してください",
    });
  });

  it("keeps the legacy one-file flow result shape", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(requestWithFile(csv(1001)));
    expect(response.status).toBe(200);
    expect(client.upserts.map((chunk) => chunk.length)).toEqual([1000, 1]);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_apply_upload", { p_upload_id: "upload-1", p_limit: 1000 });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { assignments: 1001, parent_updated: 999, parent_inserted: 2 },
    });
  });

  it("resumes a failed upload from the apply endpoint", async () => {
    const client = adminClient("manager", {
      upload: { id: "upload-1", status: "failed", row_count: 2500, result: applyRow(1000, 1500) },
      rpcResults: [
        { data: [applyRow(1000, 500)], error: null },
        { data: [applyRow(500, 0)], error: null },
      ],
    });
    mocks.getAdmin.mockReturnValue(client);
    const response = await APPLY_POST(new Request("http://test"), { params: Promise.resolve({ id: "upload-1" }) });
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledTimes(3);
    expect(client.updates.at(-1)?.values).toMatchObject({ status: "done", result: { assignments: 2500, remaining: 0 } });
  });

  it("rejects apply endpoint below manager", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("staff"));
    const response = await APPLY_POST(new Request("http://test"), { params: Promise.resolve({ id: "upload-1" }) });
    expect(response.status).toBe(403);
  });

  it("rejects apply endpoint when the upload is already done", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("manager", { upload: { id: "upload-1", status: "done", row_count: 1, result: applyRow(1, 0) } }));
    const response = await APPLY_POST(new Request("http://test"), { params: Promise.resolve({ id: "upload-1" }) });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "この取り込みは反映済みです" });
  });
});
