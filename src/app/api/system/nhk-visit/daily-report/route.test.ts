import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  loadNhkVisitRows: vi.fn(),
  sendMessage: vi.fn(),
  logRows: [] as Array<{ id: string }>,
  inserts: [] as unknown[],
}));

vi.mock("@/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server", () => ({
  loadNhkVisitRows: mocks.loadNhkVisitRows,
  monthEnd: (date: string) => `${date.slice(0, 7)}-30`,
  summaryLoadStart: (date: string) => `${date.slice(0, 7)}-01`,
}));

vi.mock("@/lib/chatwork", () => ({
  ChatworkClient: vi.fn().mockImplementation(function ChatworkClientMock() {
    return {
    sendMessage: mocks.sendMessage,
    };
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "system_nhk_visit_daily_report_log") throw new Error(`unexpected table ${table}`);
      const selectChain = {
        eq: () => selectChain,
        limit: async () => ({ data: mocks.logRows, error: null }),
      };
      return {
        select: () => selectChain,
        insert: async (value: unknown) => {
          mocks.inserts.push(value);
          return { error: null };
        },
      };
    },
  }),
}));

function request(secret = "cron-secret") {
  return new Request("http://test/api/system/nhk-visit/daily-report?date=2026-09-24", {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("NHK visit daily report route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logRows = [];
    mocks.inserts = [];
    mocks.loadNhkVisitRows.mockResolvedValue([]);
    mocks.sendMessage.mockResolvedValue({ message_id: "cw-1" });
    process.env.CRON_SECRET = "cron-secret";
    process.env.CHATWORK_API_TOKEN = "cw-token";
    process.env.CHATWORK_DEV_ROOM_ID = "dev-room";
    delete process.env.NHK_REPORT_CHATWORK_ROOM_ID;
  });

  it("rejects an invalid bearer token", async () => {
    const response = await POST(request("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  it("skips when the date was already sent successfully", async () => {
    mocks.logRows = [{ id: "log-1" }];
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, skipped: true });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });

  // Vercel の定時実行は GET で呼ぶので、GET でも同じように送れること
  it("also runs from a GET request (Vercel cron)", async () => {
    const getRequest = new Request("http://test/api/system/nhk-visit/daily-report?date=2026-09-24", {
      method: "GET",
      headers: { authorization: "Bearer cron-secret" },
    });
    const response = await GET(getRequest);
    expect(response.status).toBe(200);
    expect(mocks.sendMessage).toHaveBeenCalledWith("dev-room", expect.stringContaining("NHK訪問業務 集計"));
  });

  it("sends Chatwork message and writes a success log", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.sendMessage).toHaveBeenCalledWith("dev-room", expect.stringContaining("NHK訪問業務 集計"));
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({ report_date: "2026-09-24", destination: "chatwork:dev-room", succeeded: true });
  });
});
