import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

describe("system kanri people route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
  });

  it("loads people ordered by sort order", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const people = [{ name: "山田　花子", sort_order: 10 }];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: people, error: null }),
        }),
      }),
    });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.people).toEqual(people);
  });

  it("saves added, changed, and disabled people", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1" });
    const saved: unknown[] = [];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        upsert: (rows: unknown[]) => {
          saved.push(...rows);
          return {
            select: () => ({
              order: () => Promise.resolve({ data: rows, error: null }),
            }),
          };
        },
      }),
    });
    const { PUT } = await import("./route");

    const response = await PUT(new Request("http://localhost/api/system/kanri/people", {
      method: "PUT",
      body: JSON.stringify({
        people: [
          { name: "山田　花子", kot_name: "山田 花子", team: "宮永チーム", department: "宮永チーム", employment_kind: "アルバイト", base_wage: 1400, is_field_sales: false, active: false, sort_order: 10 },
        ],
      }),
    }));

    expect(response.status).toBe(200);
    expect(saved[0]).toMatchObject({ name: "山田　花子", active: false, base_wage: 1400 });
  });
});
