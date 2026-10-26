import "@/lib/auth/__tests__/system-view-fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  decryptToken: vi.fn(),
  sendChatworkMessageWithToken: vi.fn(),
  syncChatworkTokens: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireStaff: mocks.requireStaff }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/rill/mail/_lib/token-crypto", () => ({ decryptToken: mocks.decryptToken }));
vi.mock("@/app/system/_lib/chatwork", () => ({ sendChatworkMessageWithToken: mocks.sendChatworkMessageWithToken }));
vi.mock("@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server", () => ({ syncChatworkTokens: mocks.syncChatworkTokens }));

function request(body: unknown) {
  return new Request("http://localhost/api/system/shukkin/chatwork", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function mockToken(tokenEnc: string | null) {
  mocks.getSupabaseAdmin.mockReturnValue({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { chatwork_api_token_enc: tokenEnc, chatwork_account_name: "本人名" },
            error: null,
          }),
        }),
      }),
    }),
  });
}

describe("/api/system/shukkin/chatwork", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    delete process.env.SHUKKIN_CHATWORK_ROOM_ID;
    delete process.env.CHATWORK_DEV_ROOM_ID;
    mocks.requireStaff.mockResolvedValue({
      userId: "user-1",
      employee_id: "emp-1",
      name: "東海林 美琴",
      kot_employee_id: "1001",
    });
    mocks.decryptToken.mockReturnValue("plain-token");
  });

  it("rejects users below staff", async () => {
    mocks.requireStaff.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(request({ text: "本文", date: "2026-10-14", time: "14:00" }));

    expect(response.status).toBe(403);
  });

  it("rejects empty text", async () => {
    const { POST } = await import("./route");

    const response = await POST(request({ text: "  ", date: "2026-10-14", time: "14:00" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("送る文面がありません");
  });

  it("rejects missing room configuration", async () => {
    const { POST } = await import("./route");

    const response = await POST(request({ text: "本文", date: "2026-10-14", time: "14:00" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("送り先のルームが設定されていません");
  });

  it("rejects missing own Chatwork token", async () => {
    process.env.CHATWORK_DEV_ROOM_ID = "dev-room";
    mockToken(null);
    const { POST } = await import("./route");

    const response = await POST(request({ text: "本文", date: "2026-10-14", time: "14:00" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Chatwork の API トークンが従業員名簿に登録されていません。事務へ連絡してください");
  });

  it("sends the text as-is to the configured room", async () => {
    process.env.CHATWORK_DEV_ROOM_ID = "dev-room";
    mockToken("encrypted");
    mocks.sendChatworkMessageWithToken.mockResolvedValue({ ok: true, roomId: "dev-room", messageId: "msg-1" });
    const { POST } = await import("./route");

    const response = await POST(request({ text: "【出勤表】\n本文", date: "2026-10-14", time: "14:00" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.roomId).toBe("dev-room");
    expect(mocks.sendChatworkMessageWithToken).toHaveBeenCalledWith({
      token: "plain-token",
      roomId: "dev-room",
      text: "【出勤表】\n本文",
    });
  });

  it("returns 502 when Chatwork delivery fails", async () => {
    process.env.CHATWORK_DEV_ROOM_ID = "dev-room";
    mockToken("encrypted");
    mocks.sendChatworkMessageWithToken.mockRejectedValue(new Error("network"));
    const { POST } = await import("./route");

    const response = await POST(request({ text: "本文", date: "2026-10-14", time: "14:00" }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Chatwork に送れませんでした。しばらくしてからもう一度お試しください");
  });

  it("returns room labels without exposing room ids", async () => {
    const { GET } = await import("./route");

    let response = await GET();
    let body = await response.json();
    expect(body.roomLabel).toBe("開発ルーム（テスト）");

    process.env.SHUKKIN_CHATWORK_ROOM_ID = "prod-room";
    response = await GET();
    body = await response.json();
    expect(body.roomLabel).toBe("本番ルーム");
    expect(JSON.stringify(body)).not.toContain("prod-room");
  });
});
