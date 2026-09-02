import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  createKanriRun: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/app/system/kanri/_lib/kanri-import.server", () => ({ createKanriRun: mocks.createKanriRun }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri runs route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireManager.mockReset();
    mocks.createKanriRun.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs", {
      method: "POST",
      body: JSON.stringify({ targetDate: "2026-09-02", mode: "daily" }),
    }));

    expect(response.status).toBe(403);
  });

  it("creates a run for managers", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1", name: "東海林 美琴" });
    mocks.createKanriRun.mockResolvedValue({
      ok: true,
      runId: "run-1",
      status: "fetched",
      summary: { total: 0 },
      warnings: [],
    });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs", {
      method: "POST",
      body: JSON.stringify({ targetDate: "2026-09-02", mode: "daily" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runId).toBe("run-1");
    expect(mocks.createKanriRun).toHaveBeenCalledWith(expect.objectContaining({
      targetDate: "2026-09-02",
      mode: "daily",
      userId: "user-1",
    }));
  });

  it("returns recent runs without source payloads", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1", name: "東海林 美琴" });
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: (columns: string) => ({
          order: () => ({
            limit: () => Promise.resolve({
              data: [{ id: "run-1", summary: { total: 1 }, warnings: [] }],
              error: null,
              columns,
            }),
          }),
        }),
      }),
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/runs?limit=10"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("payload");
    expect(body.runs[0].id).toBe("run-1");
  });
});
