import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), canView: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.server }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.admin }));
vi.mock("@/lib/auth/view-permission.server", () => ({ canView: mocks.canView, viewPermissionContext: async () => ({ viewer: {} }) }));
import { GET, POST } from "./route";

const id = "00000000-0000-0000-0000-000000000001";
const job = { id, status: "queued", finished_at: null, error: null };
function query(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "in", "insert"]) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  return chain;
}
describe("call metrics sync requests", () => {
  let from: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canView.mockResolvedValue(true);
    mocks.server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: "user" } } }) },
      from: () => query({ data: { employee_id: "123", is_active: true }, error: null }) });
    from = vi.fn(); mocks.admin.mockReturnValue({ from });
  });
  function setup(active: unknown = null, seen: string | null = new Date().toISOString()) {
    from.mockReturnValueOnce(query({ data: { last_seen_at: seen }, error: null }))
      .mockReturnValueOnce(query({ data: active, error: null }))
      .mockReturnValueOnce(query({ data: job, error: null }));
  }
  it("rejects both methods for viewers without permission", async () => {
    mocks.canView.mockResolvedValue(false);
    expect((await POST()).status).toBe(403);
    expect((await GET(new Request(`http://localhost/?id=${id}`))).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("allows viewers of only the list master for POST and GET", async () => {
    mocks.canView.mockImplementation(async (page: string) => page === "system-list");
    setup();
    expect((await POST()).status).toBe(200);
    from.mockReturnValue(query({ data: job }));
    expect((await GET(new Request("http://localhost/?id=" + id))).status).toBe(200);
  });
  it("creates a request with the employee ID", async () => {
    setup();
    expect(await (await POST()).json()).toEqual({ ok: true, ...job });
    expect(from.mock.results[2].value.insert).toHaveBeenCalledWith({ requested_by: "123" });
  });
  it.each(["queued", "running"])("reuses %s requests", async status => {
    setup({ ...job, status });
    expect(await (await POST()).json()).toEqual({ ok: true, ...job, status });
    expect(from).toHaveBeenCalledTimes(2);
  });
  it("handles a concurrent insert conflict by reading the existing job", async () => {
    setup();
    from.mockReset();
    from.mockReturnValueOnce(query({ data: { last_seen_at: new Date().toISOString() } }))
      .mockReturnValueOnce(query({ data: null }))
      .mockReturnValueOnce(query({ error: { code: "23505" } }))
      .mockReturnValueOnce(query({ data: job }));
    expect(await (await POST()).json()).toEqual({ ok: true, ...job });
  });
  it.each([null, new Date(Date.now() - 10 * 60_000 - 1_000).toISOString()])("returns 503 for a stopped agent (%s)", async seen => {
    setup(null, seen);
    const response = await POST();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("ホスト PC の係が止まっています");
    expect(from).toHaveBeenCalledTimes(1);
  });
  it.each(["queued", "running", "done", "failed"])("returns %s status", async status => {
    const result = { ...job, status, finished_at: "2026-11-13T01:00:00Z", error: status === "failed" ? "stale" : null };
    from.mockReturnValue(query({ data: result }));
    expect(await (await GET(new Request(`http://localhost/?id=${id}`))).json()).toEqual({ ok: true, ...result });
  });
});
