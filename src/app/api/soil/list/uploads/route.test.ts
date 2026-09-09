import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

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

function adminClient(role = "manager") {
  const upserts: unknown[][] = [];
  const rpc = vi.fn(async (name: string) => ({
    data: name === "soil_list_apply_upload"
      ? [{ assignments: 1001, assignments_new: 1001, assignments_updated: 0, parent_updated: 999, parent_inserted: 2, parent_kept: 0, skipped: 0 }]
      : null,
    error: null,
  }));
  return {
    upserts,
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
          update: () => ({ eq: async () => ({ error: null }) }),
          select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
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

  it("imports assignments in 1,000 row chunks and applies the upload", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST(requestWithFile(csv(1001)));
    expect(response.status).toBe(200);
    expect(client.upserts.map((chunk) => chunk.length)).toEqual([1000, 1]);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_apply_upload", { p_upload_id: "upload-1" });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { assignments: 1001, parent_updated: 999, parent_inserted: 2 },
    });
  });
});
