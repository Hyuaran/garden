import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  createRecord: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/lib/kintone/records", () => ({ createRecord: mocks.createRecord }));

const validBody = {
  visitDate: "2026-09-24",
  startTime: "09:30",
  endTime: "18:00",
  destination: "NHK奈良",
  newGround: 1,
  newSatellite: 1,
  addressGround: 0,
  addressSatellite: 0,
  bankCredit: 1,
  transportFee: "あり",
};

function postRequest(body: unknown = validBody) {
  return new Request("http://localhost/api/system/nhk-visit", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function adminMock() {
  const updates: unknown[] = [];
  const inserted = {
    id: "report-1",
    submitted_at: "2026-09-24T09:00:00.000Z",
    visit_date: "2026-09-24",
    start_time: "09:30:00",
    end_time: "18:00:00",
    destination: "NHK奈良",
    task_name: "対面アプローチ",
    new_ground: 1,
    new_satellite: 1,
    address_ground: 0,
    address_satellite: 0,
    bank_credit: 1,
    transport_fee: "あり",
    employee_number: "1234",
    employee_name: "東海林 美琴",
  };
  return {
    updates,
    client: {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: inserted, error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    },
  };
}

describe("nhk visit route", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireStaff.mockResolvedValue({
      userId: "user-1",
      employee_number: "1234",
      name: "東海林 美琴",
    });
    mocks.createRecord.mockResolvedValue({ id: "kintone-1" });
  });

  it("rejects an empty destination with a Japanese message", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ ...validBody, destination: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("派遣先を選んでください");
  });

  it("rejects negative counts with a Japanese message", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ ...validBody, newGround: -1 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("件数は 0 以上の整数で入力してください");
  });

  it("rejects malformed times with a Japanese message", async () => {
    const { POST } = await import("./route");

    const response = await POST(postRequest({ ...validBody, startTime: "9:30" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("時間を正しく入力してください");
  });

  it("returns 200 and keeps the Garden row when Kintone fails", async () => {
    const admin = adminMock();
    mocks.getSupabaseAdmin.mockReturnValue(admin.client);
    mocks.createRecord.mockRejectedValue(new Error("kintone_500"));
    const { POST } = await import("./route");

    const response = await POST(postRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.kintoneStatus).toBe("pending");
    expect(body.message).toContain("【派遣先】NHK奈良");
    expect(admin.updates[0]).toMatchObject({ kintone_error: "kintone_500" });
  });
});
