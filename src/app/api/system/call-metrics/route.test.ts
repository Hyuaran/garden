import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
import { GET } from "./route";

function client(options: { user?: boolean; role?: string; roleError?: boolean; rpcError?: boolean } = {}) {
  const rpc = vi.fn().mockResolvedValue(options.rpcError
    ? { data: null, error: { code: "XX000", message: "secret db detail" } }
    : { data: { metrics: [], result_flags: [] }, error: null });
  return {
    rpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === false ? null : { id: "user-1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => options.roleError ? { data: null, error: { message: "db detail" } } : { data: { garden_role: options.role ?? "manager" }, error: null } }) }) }) }),
  };
}

const request = (query = "from=2026-08-01&to=2026-08-12") => new Request(`http://localhost/api/system/call-metrics?${query}`);

describe("GET /api/system/call-metrics", () => {
  beforeEach(() => mocks.createServerClient.mockReset());
  it("returns 401 when signed out", async () => {
    mocks.createServerClient.mockResolvedValue(client({ user: false }));
    expect((await GET(request())).status).toBe(401);
  });
  it("returns 403 below manager", async () => {
    mocks.createServerClient.mockResolvedValue(client({ role: "staff" }));
    expect((await GET(request())).status).toBe(403);
  });
  it.each(["manager", "admin", "super_admin"])("allows %s", async (role) => {
    const supabase = client({ role }); mocks.createServerClient.mockResolvedValue(supabase);
    const response = await GET(request("from=2026-08-01&to=2026-08-12&listName=A"));
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("system_call_metrics", { p_from: "2026-08-01", p_to: "2026-08-12", p_list_name: "A" });
  });
  it("returns 400 for invalid dates", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    expect((await GET(request("from=bad&to=2026-08-12"))).status).toBe(400);
  });
  it("sanitizes RPC failures", async () => {
    mocks.createServerClient.mockResolvedValue(client({ rpcError: true }));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "集計の取得に失敗しました" });
  });
});

