import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri calculate route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/calculate", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("calculates with the newest saved monthly inputs and saves the management sheet", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const savedRows: unknown[] = [];
    const manualInputs = { hoursByTeamByDate: { A: { "2026-09-01": 5 } }, openRateByTeamByProduct: { A: { 商品: 0.5 } } };
    const tableResult = (table: string) => {
      if (table === "system_kanri_run") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-09-01" }, error: null }),
            }),
            gte: () => ({
              lte: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [
                      { id: "run-2", target_date: "2026-09-02", created_at: "2026-09-02T00:00:00Z" },
                      { id: "run-1", target_date: "2026-09-01", created_at: "2026-09-01T00:00:00Z" },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "system_kanri_source_row") {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ source: "kintone_customer", source_app: null, record_id: "1", payload: { 実績日: "2026-09-01", チーム名: "A", 商材名区分1: "別名" } }],
              error: null,
            }),
          }),
        };
      }
      if (table === "system_kanri_month_setting") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { holidays: [] }, error: null }) }) }) };
      }
      if (table === "system_kanri_point_master") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [{ product: "商品", kintone_names: ["別名"], category: "hikari", coefficient: 2, unit_price: 100, sort_order: 10, active: true }], error: null }),
            }),
          }),
        };
      }
      if (table === "system_kanri_team") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [{ team: "A", sort_order: 10, active: true }], error: null }),
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
                  maybeSingle: () => Promise.resolve({ data: { run_id: "run-1", grid: manualInputs, calculated_at: "2026-09-02T01:00:00Z" }, error: null }),
                }),
              }),
            }),
          }),
        }),
        upsert: (row: unknown) => {
          savedRows.push(row);
          return Promise.resolve({ error: null });
        },
      };
    };
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn(tableResult) });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/calculate", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.grid.days[0].teams.A.hours).toBe(5);
    expect(savedRows).toHaveLength(1);
  });
});
