import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSupabaseAdmin: vi.fn(), deliverCallReport: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/system/_lib/call-report-delivery", () => ({ deliverCallReport: mocks.deliverCallReport }));
import { GET } from "./route";

const request = (token = "cron-secret") => new Request("http://localhost/api/system/call-report/cron", {
  headers: { authorization: `Bearer ${token}` },
});

function rpcData(calls: number) {
  return {
    authorized: true,
    metrics: calls ? [{ list_name: "A", call_count: calls }] : [],
    employee_metrics: calls ? [{ employee_name: "社員A", call_count: calls, effective_count: 7, order_count: 2, acquired_count: 1 }] : [],
  };
}

describe("GET /api/system/call-report/cron", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T06:05:00Z")); // Wednesday 15:05 JST
    process.env.CRON_SECRET = "cron-secret";
    mocks.deliverCallReport.mockReset().mockResolvedValue({ attached: true });
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.CRON_SECRET;
    vi.restoreAllMocks();
  });

  it("fails closed for missing and invalid cron secrets", async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request())).status).toBe(500);
    process.env.CRON_SECRET = "cron-secret";
    expect((await GET(request("wrong"))).status).toBe(401);
  });

  it("skips outside the delivery window without querying", async () => {
    vi.setSystemTime(new Date("2026-08-12T05:05:00Z")); // 14:05 JST
    const rpc = vi.fn();
    mocks.getSupabaseAdmin.mockReturnValue({ rpc });
    expect(await (await GET(request())).json()).toMatchObject({ ok: true, reason: "out_of_window", sent: false, aggregateMs: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("skips a zero-call day without sending", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: rpcData(0), error: null });
    mocks.getSupabaseAdmin.mockReturnValue({ rpc });
    expect(await (await GET(request())).json()).toMatchObject({ ok: true, reason: "no_calls", sent: false });
    expect(rpc).toHaveBeenCalledWith("system_call_metrics", { p_from: "2026-08-12", p_to: "2026-08-12", p_list_name: null, p_employee_name: null });
    expect(mocks.deliverCallReport).not.toHaveBeenCalled();
  });

  it("sends a non-zero report to the fixed development sender", async () => {
    mocks.getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: rpcData(10), error: null }) });
    expect(await (await GET(request())).json()).toMatchObject({ ok: true, skipped: false, sent: true, aggregateMs: expect.any(Number), postMs: expect.any(Number) });
    expect(mocks.deliverCallReport).toHaveBeenCalledTimes(1);
  });

  it("does not silently treat an RPC authorization payload as zero calls", async () => {
    mocks.getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { error: "forbidden" }, error: null }) });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ ok: false, error: "集計の取得に失敗しました" });
    expect(mocks.deliverCallReport).not.toHaveBeenCalled();
  });

  it("rejects the pre-migration RPC shape instead of treating it as no calls", async () => {
    mocks.getSupabaseAdmin.mockReturnValue({ rpc: vi.fn().mockResolvedValue({ data: { metrics: [], employee_metrics: [] }, error: null }) });
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(mocks.deliverCallReport).not.toHaveBeenCalled();
  });
});
