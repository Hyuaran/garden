import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), deliverCallReport: vi.fn() }));
vi.mock("@/app/_lib/supabase/server", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("@/app/system/_lib/call-report-delivery", () => ({ deliverCallReport: mocks.deliverCallReport }));
import { POST } from "./route";

function client(options: { user?: boolean; role?: string; rpcError?: boolean; calls?: number } = {}) {
  const calls = options.calls ?? 10;
  const rpc = vi.fn().mockResolvedValue(options.rpcError ? { data: null, error: { code: "XX000", message: "secret" } } : { data: {
    metrics: calls ? [{ list_name: "A", call_count: calls }] : [],
    employee_metrics: calls ? [{ employee_name: "社員A", call_count: calls, effective_count: 7, order_count: 2, acquired_count: 1 }] : [],
  }, error: null });
  return {
    rpc,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === false ? null : { id: "user-1" } } }) },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { garden_role: options.role ?? "manager" }, error: null }) }) }) }) }),
  };
}
const request = (body: unknown) => new Request("http://localhost/api/system/call-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("POST /api/system/call-report", () => {
  beforeEach(() => {
    mocks.createServerClient.mockReset(); mocks.deliverCallReport.mockReset().mockResolvedValue({ attached: true });
    vi.spyOn(console, "info").mockImplementation(() => undefined); vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  it("returns 401 when signed out", async () => {
    mocks.createServerClient.mockResolvedValue(client({ user: false }));
    expect((await POST(request({ mode: "preview" }))).status).toBe(401);
  });
  it("returns 403 below manager", async () => {
    mocks.createServerClient.mockResolvedValue(client({ role: "staff" }));
    expect((await POST(request({ mode: "preview" }))).status).toBe(403);
  });
  it.each(["manager", "admin", "super_admin"])("allows %s preview without sending", async (role) => {
    const supabase = client({ role }); mocks.createServerClient.mockResolvedValue(supabase);
    const response = await POST(request({ mode: "preview", date: "2026-08-12" }));
    expect(await response.json()).toMatchObject({ ok: true, skipped: false, summary: { totalCalls: 10 }, aggregateMs: expect.any(Number) });
    expect(supabase.rpc).toHaveBeenCalledWith("system_call_metrics", { p_from: "2026-08-12", p_to: "2026-08-12", p_list_name: null, p_employee_name: null });
    expect(mocks.deliverCallReport).not.toHaveBeenCalled();
  });
  it("sends only in send mode", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    const response = await POST(request({ mode: "send", date: "2026-08-12" }));
    expect(await response.json()).toMatchObject({ ok: true, sent: true, elapsedMs: { aggregate: expect.any(Number), post: expect.any(Number) } });
    expect(mocks.deliverCallReport).toHaveBeenCalledTimes(1);
  });
  it("skips zero-call days without sending", async () => {
    mocks.createServerClient.mockResolvedValue(client({ calls: 0 }));
    expect(await (await POST(request({ mode: "send", date: "2026-08-12" }))).json()).toMatchObject({ ok: true, skipped: true, sent: false });
    expect(mocks.deliverCallReport).not.toHaveBeenCalled();
  });
  it("rejects invalid mode and date", async () => {
    mocks.createServerClient.mockResolvedValue(client());
    expect((await POST(request({ mode: "other" }))).status).toBe(400);
    expect((await POST(request({ mode: "preview", date: "bad" }))).status).toBe(400);
  });
  it("sanitizes RPC failures", async () => {
    mocks.createServerClient.mockResolvedValue(client({ rpcError: true }));
    const response = await POST(request({ mode: "preview", date: "2026-08-12" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "集計の取得に失敗しました" });
  });
});
