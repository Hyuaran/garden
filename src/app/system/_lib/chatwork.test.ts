import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallReportChatworkError, sendCallReportMessage, sendCallReportWithAttachment } from "./chatwork";

describe("sendCallReportMessage", () => {
  beforeEach(() => { process.env.CHATWORK_API_TOKEN = "test-token"; process.env.CHATWORK_DEV_ROOM_ID = "dev-room"; });
  afterEach(() => { delete process.env.CHATWORK_API_TOKEN; delete process.env.CHATWORK_DEV_ROOM_ID; delete process.env.CHATWORK_ROOM_KYOUYU_ID; });
  it("posts form-urlencoded text to the env-selected development room", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCallReportMessage("本文 & test", fetchMock);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/dev-room/messages");
    expect(init).toMatchObject({ method: "POST", headers: { "X-ChatWorkToken": "test-token", "Content-Type": "application/x-www-form-urlencoded" } });
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get("body")).toBe("本文 & test");
  });
  it("prefers the shared production room (CHATWORK_ROOM_KYOUYU_ID) over the dev room", async () => {
    process.env.CHATWORK_ROOM_KYOUYU_ID = "kyouyu-room";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCallReportMessage("x", fetchMock);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/kyouyu-room/messages");
  });
  it("falls back to the dev room when the production room is empty", async () => {
    process.env.CHATWORK_ROOM_KYOUYU_ID = "";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCallReportMessage("x", fetchMock);
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/dev-room/messages");
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

describe("sendCallReportWithAttachment", () => {
  beforeEach(() => { process.env.CHATWORK_API_TOKEN = "test-token"; process.env.CHATWORK_DEV_ROOM_ID = "dev-room"; });
  afterEach(() => { delete process.env.CHATWORK_API_TOKEN; delete process.env.CHATWORK_DEV_ROOM_ID; delete process.env.CHATWORK_ROOM_KYOUYU_ID; });

  it("sends message and PDF together in one multipart request", async () => {
    process.env.CHATWORK_ROOM_KYOUYU_ID = "shared-room";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await sendCallReportWithAttachment("本文", new Uint8Array([1, 2, 3]), "集計.pdf", fetchMock);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.chatwork.com/v2/rooms/shared-room/files");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "X-ChatWorkToken": "test-token" });
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("message")).toBe("本文");
    expect(form.get("file")).toBeInstanceOf(Blob);
    expect((form.get("file") as File).name).toBe("集計.pdf");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
