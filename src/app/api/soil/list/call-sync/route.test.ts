import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: () => mocks.createServerClient() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { GET, POST } from "./route";

function serverClient(userId: string | null = "user-1") {
  return {
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId } : null } }),
    },
  };
}

function queryResult<T>(data: T | null, error: { message: string } | null = null) {
  const query = {
    select: () => query,
    eq: () => query,
    is: () => query,
    maybeSingle: async () => ({ data, error }),
  };
  return query;
}

function adminClient(options: {
  role?: string | null;
  state?: Record<string, unknown> | null;
  rpcData?: unknown;
  rpcError?: string;
} = {}) {
  const calls: Array<{ table: string; column?: string; value?: unknown }> = [];
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcData ?? [{ phones: 38335, call_rows: 41200, synced_through: "2026-09-07" }],
    error: options.rpcError ? { message: options.rpcError } : null,
  });
  return {
    calls,
    rpc,
    from(table: string) {
      calls.push({ table });
      if (table === "root_employees") return queryResult({ garden_role: options.role ?? "manager" });
      if (table === "soil_list_call_sync_state") {
        return queryResult(options.state ?? {
          synced_through: "2026-09-07",
          last_run_at: "2026-09-07T10:35:00Z",
          last_phones: 38335,
          last_rows: 41200,
        });
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

describe("/api/soil/list/call-sync", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset().mockResolvedValue(serverClient());
    mocks.getAdmin.mockReset();
  });

  it("returns 403 for GET when the role is below staff", async () => {
    mocks.getAdmin.mockReturnValue(adminClient({ role: "cs" }));
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("returns the sync state for staff and above", async () => {
    mocks.getAdmin.mockReturnValue(adminClient({ role: "staff" }));
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      canSync: false,
      state: { syncedThrough: "2026-09-07", lastRunAt: "2026-09-07T10:35:00Z", phones: 38335, callRows: 41200 },
    });
  });

  it("returns 403 for POST when the role is below manager", async () => {
    const client = adminClient({ role: "staff" });
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST();
    expect(response.status).toBe(403);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("calls the refresh without arguments and formats the result", async () => {
    const client = adminClient();
    mocks.getAdmin.mockReturnValue(client);
    const response = await POST();
    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("soil_list_refresh_call_summary");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      result: { phones: 38335, callRows: 41200, syncedThrough: "2026-09-07" },
    });
  });
});
