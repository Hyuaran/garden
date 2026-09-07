import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  sendKanriReportMessage: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/system/_lib/chatwork", () => ({ sendKanriReportMessage: mocks.sendKanriReportMessage }));

const kanriGrid = {
  teams: ["A"],
  totals: {
    all: { hours: 10, efficiency: 0.2, total: 2, points: 3, amount: 0, pointEfficiency: 0.3, amountPerHour: null },
    teams: {
      A: { hours: 10, efficiency: 0.2, total: 2, points: 3, amount: 0, products: {}, pointsByProduct: {}, amountByProduct: {} },
    },
  },
};

describe("system kanri Chatwork route", () => {
  beforeEach(() => {
    mocks.requireManager.mockReset();
    mocks.getSupabaseAdmin.mockReset();
    mocks.sendKanriReportMessage.mockReset();
    vi.unstubAllEnvs();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/chatwork", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("asks users to calculate first before sending", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1", name: "責任者" });
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn((table: string) => {
      if (table === "system_kanri_run") {
        return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-08-31", mode: "closing", creator_name: "作成者", summary: { total: 0 } }, error: null }) }) }) };
      }
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }) };
    }) });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/chatwork", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("先に「計算する」を押してください");
    expect(mocks.sendKanriReportMessage).not.toHaveBeenCalled();
  });

  it("sends the message and records delivery in summary", async () => {
    mocks.requireManager.mockResolvedValue({ userId: "user-1", name: "責任者" });
    mocks.sendKanriReportMessage.mockResolvedValue({ ok: true, roomId: "room-from-env" });
    let savedSummary: unknown = null;
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn((table: string) => {
      if (table === "system_kanri_run") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "run-1", target_date: "2026-08-31", mode: "closing", creator_name: "作成者", summary: { total: 1 } }, error: null }) }) }),
          update: (row: { summary: unknown }) => {
            savedSummary = row.summary;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { grid: kanriGrid, calculated_at: "2026-09-07T00:00:00Z" }, error: null }) }) }) }) };
    }) });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/system/kanri/runs/run-1/chatwork", { method: "POST" }), {
      params: Promise.resolve({ id: "run-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.sendKanriReportMessage).toHaveBeenCalledWith(expect.stringContaining("【管理表】2026/08/31（締めチェック）"));
    expect(savedSummary).toEqual(expect.objectContaining({
      total: 1,
      chatwork: expect.objectContaining({ roomId: "room-from-env", by: "責任者" }),
    }));
    expect(body.chatwork.roomId).toBe("room-from-env");
  });
});
