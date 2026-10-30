import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { sendMessage } = vi.hoisted(() => ({ sendMessage: vi.fn() }));
vi.mock("@/lib/chatwork/client", () => ({
  ChatworkClient: class { sendMessage = sendMessage; },
}));
const fetchMock = vi.fn();
const event = (message: object) => ({ type: "message", source: { type: "user", userId: "U123" }, message });
function post(events: unknown[] = [], account = "hikari", signature?: string, secret = "hikari-secret") {
  const body = JSON.stringify({ events });
  return POST(new Request(`http://localhost/api/system/line/inbox/${account}`, {
    method: "POST", body,
    headers: { "x-line-signature": signature ?? createHmac("sha256", secret).update(body).digest("base64") },
  }), { params: Promise.resolve({ account }) });
}

describe("LINE official account inbox", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    for (const account of ["HIKARI", "SHOKAI"]) {
      vi.stubEnv(`LINE_${account}_CHANNEL_SECRET`, `${account.toLowerCase()}-secret`);
      vi.stubEnv(`LINE_${account}_CHANNEL_ACCESS_TOKEN`, `${account.toLowerCase()}-token`);
    }
    vi.stubEnv("CHATWORK_API_TOKEN", "cw-token");
    vi.stubEnv("CHATWORK_DEV_ROOM_ID", "dev-room");
    vi.stubEnv("LINE_INBOX_CHATWORK_ROOM_ID", "");
    vi.stubEnv("BLOOM_CHATWORK_DRY_RUN", "false");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ displayName: "山田 太郎" })));
    sendMessage.mockResolvedValue({ message_id: "1" });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("署名を確認し、改行を保って開発ルームに送る", async () => {
    expect((await post([event({ type: "text", text: "1\n2\n3" })])).status).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith("dev-room", "[info][title]ヒカリのプロ からメッセージが届きました[/title]送信者：山田 太郎\n1\n2\n3[/info]");
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://api.line.me/v2/bot/profile/U123", { headers: { Authorization: "Bearer hikari-token" } });
  });
  it.each(["bad", "x".repeat(44), ""])("不正署名 %s は401", async signature => {
    expect((await post([event({ type: "text", text: "test" })], "hikari", signature)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("別アカウントの署名は使えない", async () => {
    expect((await post([], "shokai")).status).toBe(401);
  });
  it("紹介アカウントのトークンと指定ルームを使う", async () => {
    vi.stubEnv("LINE_INBOX_CHATWORK_ROOM_ID", "451851099");
    expect((await post([event({ type: "text", text: "test" })], "shokai", undefined, "shokai-secret")).status).toBe(200);
    expect(sendMessage).toHaveBeenCalledWith("451851099", expect.stringContaining("紹介キャンペーン事務局 から"));
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { headers: { Authorization: "Bearer shokai-token" } });
  });
  it.each([
    [{ type: "image" }, "（画像）"], [{ type: "video" }, "（動画）"],
    [{ type: "audio" }, "（音声）"], [{ type: "sticker" }, "（スタンプ）"],
    [{ type: "file", fileName: "資料.pdf" }, "（ファイル：資料.pdf）"],
    [{ type: "location", address: "東京都" }, "（位置情報：東京都）"],
  ])("文以外のメッセージを表す: %j", async (message, text) => {
    await post([event(message)]);
    expect(sendMessage).toHaveBeenCalledWith("dev-room", expect.stringContaining(`\n${text}[/info]`));
  });
  it.each(["http", "network", "empty"])("表示名取得失敗でも通知: %s", async mode => {
    if (mode === "http") fetchMock.mockResolvedValue(new Response("", { status: 404 }));
    else if (mode === "network") fetchMock.mockRejectedValue(new Error("offline"));
    else fetchMock.mockResolvedValue(new Response("{}"));
    await post([event({ type: "text", text: "test" })]);
    expect(sendMessage).toHaveBeenCalledWith("dev-room", expect.stringContaining("送信者：（名前を取得できませんでした）"));
  });
  it("本文・表示名・ファイル名内のChatwork記法を無効化", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ displayName: "[/title][To:123]" })));
    await post([event({ type: "text", text: "[info]\n[/info][title][To:456]" }), event({ type: "file", fileName: "[To:789].pdf" })]);
    expect(sendMessage.mock.calls[0][1]).toContain("送信者：［/title]［To:123]\n［info]\n［/info]［title]［To:456]");
    expect(sendMessage.mock.calls[1][1]).toContain("（ファイル：［To:789].pdf）");
  });
  it("送信失敗後も次のイベントを処理し200", async () => {
    sendMessage.mockRejectedValueOnce(new Error("failed"));
    expect((await post([event({ type: "image" }), event({ type: "sticker" })])).status).toBe(200);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith("line_inbox_event_failed", "hikari", "failed");
  });
  it("友だち追加・ブロック・グループ・ルームを無視", async () => {
    await post([{ type: "follow" }, { type: "unfollow" }, ...["group", "room"].map(type => ({ ...event({ type: "text", text: "test" }), source: { type, userId: "U123" } }))]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it("不明なaccountは404", async () => { expect((await post([], "unknown")).status).toBe(404); });
  it("空のeventsは200で外部通信しない", async () => {
    expect((await post()).status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
  it.each(["LINE_HIKARI_CHANNEL_SECRET", "LINE_HIKARI_CHANNEL_ACCESS_TOKEN", "CHATWORK_API_TOKEN", "CHATWORK_DEV_ROOM_ID"])("未設定は503: %s", async key => {
    vi.stubEnv(key, "");
    expect((await post()).status).toBe(503);
    expect(console.error).toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
