import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri Excel route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/runs/run-1/excel"), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(403);
  }, 20000);

  it("asks users to calculate first when saved sheets are missing", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn((table: string) => {
      if (table === "system_kanri_run") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-08-31" }, error: null }) }) }) };
      }
      if (table === "system_kanri_result") {
        return { select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [{ sheet: "kanri", grid: { cellValues: {} } }], error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) };
    }) });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/system/kanri/runs/run-1/excel"), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("先に「計算する」を押してください");
  });
});
