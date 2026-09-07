import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri result route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/runs/run-1/result?sheet=kanri"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns a saved result", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { run_id: "run-1", sheet: "kanri", grid: { days: [] } }, error: null }),
            }),
          }),
        }),
      }),
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/runs/run-1/result?sheet=kanri"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result.grid.days).toEqual([]);
  });
});
