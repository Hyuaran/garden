import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  decryptToken: vi.fn(),
  sendChatworkMessageWithToken: vi.fn(),
  syncChatworkTokens: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireStaff: mocks.requireStaff,
  requireManager: mocks.requireManager,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/rill/mail/_lib/token-crypto", () => ({ decryptToken: mocks.decryptToken }));
vi.mock("@/app/system/_lib/chatwork", () => ({ sendChatworkMessageWithToken: mocks.sendChatworkMessageWithToken }));
vi.mock("@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server", () => ({ syncChatworkTokens: mocks.syncChatworkTokens }));

const validBody = {
  team: "宮永チーム",
  commuteFlag: "いない",
  commutePeople: [],
  trainingFlag: "いない",
  trainingPeople: [],
  referralFlag: "いない",
  referralPeople: [],
  otherNotes: "確認お願いします。",
};

function request(body = validBody) {
  return new Request("http://localhost/api/system/payroll-notice", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("payroll notice route", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    process.env.CHATWORK_DEV_ROOM_ID = "dev-room";
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

    const response = await POST(request());

    expect(response.status).toBe(403);
  });

  it("returns 400 without inserting when the user has no token", async () => {
    const insert = vi.fn();
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { chatwork_api_token_enc: null }, error: null }) }),
        }),
        insert,
      }),
    });
    const { POST } = await import("./route");

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Chatwork の API トークン");
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserts a row and updates Chatwork delivery columns on success", async () => {
    const updates: unknown[] = [];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { chatwork_api_token_enc: "encrypted", chatwork_account_name: "本人名" }, error: null }) }),
        }),
        insert: (payload: unknown) => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "notice-1", submitted_at: "2026-09-07T09:30:00.000Z", payload, table }, error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    });
    mocks.sendChatworkMessageWithToken.mockResolvedValue({ ok: true, roomId: "dev-room", messageId: "msg-1" });
    const { POST } = await import("./route");

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notice.id).toBe("notice-1");
    expect(mocks.sendChatworkMessageWithToken).toHaveBeenCalledWith(expect.objectContaining({
      token: "plain-token",
      roomId: "dev-room",
    }));
    expect(updates[0]).toMatchObject({ chatwork_message_id: "msg-1", chatwork_room_id: "dev-room", chatwork_error: null });
  });

  it("leaves a row with chatwork_error when delivery fails", async () => {
    const updates: unknown[] = [];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: { chatwork_api_token_enc: "encrypted" }, error: null }) }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: "notice-1", submitted_at: "2026-09-07T09:30:00.000Z" }, error: null }),
          }),
        }),
        update: (payload: unknown) => {
          updates.push(payload);
          return { eq: () => Promise.resolve({ error: null }) };
        },
      }),
    });
    mocks.sendChatworkMessageWithToken.mockRejectedValue(new Error("network"));
    const { POST } = await import("./route");

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Chatwork に送れませんでした。記録は残っています。管理者へ問い合わせてください");
    expect(updates[0]).toMatchObject({ chatwork_error: "Chatwork API request failed" });
  });

  it("requires manager for history", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { GET } = await import("./route");

    const response = await GET();

    expect(response.status).toBe(403);
  });
});
