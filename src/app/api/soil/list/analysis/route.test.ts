import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { GET } from "./route";

function serverClient() {
  return { auth: { getUser: async () => ({ data: { user: { id: "user-1" } } }) } };
}

function adminClient(role = "manager") {
  const rpc = vi.fn(async () => ({
    data: [{ list_name: "リスト_20260907", list_loaded_on: "2026-09-07", row_count: 10, called_count: 3, purchase_history_count: 2, last_called_on: "2026-09-09" }],
    error: null,
  }));
  return {
    rpc,
    from() {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { name: "東海林 美琴", garden_role: role }, error: null }),
      };
      return query;
    },
  };
}

describe("/api/soil/list/analysis", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset().mockResolvedValue(serverClient());
    mocks.getAdmin.mockReset();
    vi.resetModules();
  });

  it("returns 403 below manager", async () => {
    mocks.getAdmin.mockReturnValue(adminClient("staff"));
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns list analysis rows", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_analysis_by_list");
    await expect(response.json()).resolves.toMatchObject({ ok: true, rows: [{ list_name: "リスト_20260907", row_count: 10 }] });
  });
});
