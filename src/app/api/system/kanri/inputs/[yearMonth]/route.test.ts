import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri inputs route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/inputs/2026-09"), {
      params: Promise.resolve({ yearMonth: "2026-09" }),
    });

    expect(response.status).toBe(403);
  });

  it("saves manual inputs against the latest monthly run", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const saved = { hoursByTeamByDate: { team: { "2026-09-01": 5 } }, openRateByTeamByProduct: { team: { product: 0.8 } } };
    const admin = {
      from: vi.fn((table: string) => {
        if (table === "system_kanri_run") {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-09-01" }, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          upsert: vi.fn((row: unknown) => ({
            select: () => ({
              single: () => Promise.resolve({ data: { grid: saved, row }, error: null }),
            }),
          })),
        };
      }),
    };
    mocks.getSupabaseAdmin.mockReturnValue(admin);
    const { PUT } = await import("./route");

    const response = await PUT(new Request("http://localhost/api/system/kanri/inputs/2026-09", {
      method: "PUT",
      body: JSON.stringify({ inputs: saved }),
    }), { params: Promise.resolve({ yearMonth: "2026-09" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inputs).toEqual(saved);
  });

  it("loads the newest saved monthly inputs even when the latest run has none", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const inherited = { hoursByTeamByDate: { team: { "2026-09-01": 7 } }, openRateByTeamByProduct: { team: { product: 0.6 } } };
    const runs = [
      { id: "run-new", target_date: "2026-09-02", created_at: "2026-09-02T00:00:00Z" },
      { id: "run-old", target_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z" },
    ];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "system_kanri_run") {
          return {
            select: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: runs, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: () => Promise.resolve({ data: { run_id: "run-old", grid: inherited, calculated_at: "2026-09-02T01:00:00Z" }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/inputs/2026-09"), {
      params: Promise.resolve({ yearMonth: "2026-09" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.inputs).toEqual(inherited);
    expect(body.run.id).toBe("run-old");
  });
});
