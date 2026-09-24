import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  loadNhkVisitRows: vi.fn(),
  admin: {
    from: vi.fn(),
  },
}));

vi.mock("@/app/system/forms/nhk-visit/_lib/nhk-visit-summary.server", () => ({
  loadNhkVisitRows: mocks.loadNhkVisitRows,
  monthEnd: (date: string) => `${date.slice(0, 7)}-30`,
  monthStart: (date: string) => `${date.slice(0, 7)}-01`,
  summaryLoadStart: (date: string) => `${date.slice(0, 7)}-01`,
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => mocks.admin,
}));

function signature(body: string, secret = "line-secret") {
  return createHmac("sha256", secret).update(body).digest("base64");
}

describe("LINE webhook route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.LINE_CHANNEL_SECRET = "line-secret";
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "line-token";
    mocks.loadNhkVisitRows.mockResolvedValue([]);
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  });

  it("returns 401 when signature is wrong", async () => {
    const response = await POST(new Request("http://test/api/system/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": "wrong" },
      body: JSON.stringify({ events: [] }),
    }));
    expect(response.status).toBe(401);
  });

  it("replies to a matching keyword without push", async () => {
    const body = JSON.stringify({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "group", groupId: "group-1" },
        message: { type: "text", text: "2026-09-24集計" },
      }],
    });
    const response = await POST(new Request("http://test/api/system/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": signature(body) },
      body,
    }));
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledWith("https://api.line.me/v2/bot/message/reply", expect.objectContaining({ method: "POST" }));
  });

  it("does not reply to unrelated text", async () => {
    const body = JSON.stringify({
      events: [{
        type: "message",
        replyToken: "reply-token",
        source: { type: "group", groupId: "group-1" },
        message: { type: "text", text: "こんにちは" },
      }],
    });
    const response = await POST(new Request("http://test/api/system/line/webhook", {
      method: "POST",
      headers: { "x-line-signature": signature(body) },
      body,
    }));
    expect(response.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
