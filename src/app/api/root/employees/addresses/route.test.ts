import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireManager: mocks.requireManager,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));

function adminWithRows(rows: Array<Record<string, unknown>>) {
  return {
    from: (table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => Promise.resolve({
          data: table === "root_employee_profile_current"
            ? rows.filter((row) => row[column] === value)
            : [],
          error: null,
        })),
      })),
    }),
  };
}

describe("root employee addresses route", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireManager.mockResolvedValue({ employee_id: "EMP-0001", employee_number: "0001" });
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false });
    expect(mocks.getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns address map for managers and above", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(adminWithRows([
      {
        employee_id: "EMP-1559",
        category: "address",
        payload: {
          postal_code: "6360001",
          full: "奈良県北葛城郡王寺町舟戸1丁目1番25号",
          building: "",
          room: null,
          phone: "09000000000",
        },
        source: "roster",
        recorded_at: "2026-09-14T00:00:00.000Z",
      },
    ]));
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      "EMP-1559": {
        postal_code: "6360001",
        full: "奈良県北葛城郡王寺町舟戸1丁目1番25号",
        building: null,
        room: null,
        source: "roster",
        recorded_at: "2026-09-14T00:00:00.000Z",
      },
    });
    expect(JSON.stringify(body)).not.toContain("09000000000");
  });

  it("does not return categories other than address", async () => {
    mocks.getSupabaseAdmin.mockReturnValue(adminWithRows([
      {
        employee_id: "EMP-1559",
        category: "address",
        payload: { postal_code: "6360001", full: "奈良県北葛城郡王寺町舟戸1丁目1番25号" },
        source: "roster",
        recorded_at: "2026-09-14T00:00:00.000Z",
      },
      {
        employee_id: "EMP-1559",
        category: "bank_account",
        payload: { account_number: "1234567" },
        source: "bank_list",
        recorded_at: "2026-09-15T00:00:00.000Z",
      },
    ]));
    const { GET } = await import("./route");

    const body = await (await GET()).json();

    expect(Object.keys(body)).toEqual(["EMP-1559"]);
    expect(JSON.stringify(body)).not.toContain("1234567");
  });
});
