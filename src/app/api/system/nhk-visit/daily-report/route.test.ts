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

const sampleRow = {
  visit_date: "2026-09-24", start_time: "09:30", end_time: "18:00", destination: "NHK奈良",
  new_ground: 1, new_satellite: 0, address_ground: 0, address_satellite: 0, bank_credit: 0,
  employee_number: "0008", employee_name: "東海林 美琴",
};

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
    mocks.loadNhkVisitRows.mockResolvedValue([sampleRow]);
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

  // その日の報告が 0 件なら送らない（記録は succeeded=false・no_reports で残す）
  it("does not send when there are no reports for the day", async () => {
    mocks.loadNhkVisitRows.mockResolvedValue([]);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, skipped: true, reason: "no_reports" });
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({ report_date: "2026-09-24", succeeded: false, error: "no_reports" });
  });

  it("sends Chatwork message and writes a success log", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.sendMessage).toHaveBeenCalledWith("dev-room", expect.stringContaining("NHK訪問業務 集計"));
    expect(mocks.inserts).toHaveLength(1);
    expect(mocks.inserts[0]).toMatchObject({ report_date: "2026-09-24", destination: "chatwork:dev-room", succeeded: true });
  });
});
