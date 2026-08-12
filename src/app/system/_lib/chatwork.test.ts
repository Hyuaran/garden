import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallReportChatworkError, sendCallReportMessage } from "./chatwork";

describe("sendCallReportMessage", () => {
  beforeEach(() => { process.env.CHATWORK_API_TOKEN = "test-token"; process.env.CHATWORK_DEV_ROOM_ID = "dev-room"; });
  afterEach(() => { delete process.env.CHATWORK_API_TOKEN; delete process.env.CHATWORK_DEV_ROOM_ID; });
  it("posts form-urlencoded text to the env-selected development room", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCallReportMessage("本文 & test", fetchMock);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/dev-room/messages");
    expect(init).toMatchObject({ method: "POST", headers: { "X-ChatWorkToken": "test-token", "Content-Type": "application/x-www-form-urlencoded" } });
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("body")).toBe("本文 & test");
  });
  it("requires both server-side env values", async () => {
    delete process.env.CHATWORK_DEV_ROOM_ID;
    await expect(sendCallReportMessage("text", vi.fn())).rejects.toThrow("設定が不足");
  });
  it("exposes only HTTP status for API failures", async () => {
    const error = await sendCallReportMessage("secret message", vi.fn().mockResolvedValue(new Response("secret response body", { status: 429 }))).catch((cause) => cause);
    expect(error).toBeInstanceOf(CallReportChatworkError);
    expect(error.status).toBe(429);
    expect(error.message).toBe("Chatwork API request failed (429)");
    expect(JSON.stringify(error)).not.toContain("secret response body");
  });
});
