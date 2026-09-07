import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  isValidChatworkApiToken: vi.fn(),
  getChatworkMe: vi.fn(),
  encryptToken: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({
  requireManager: mocks.requireManager,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: mocks.getSupabaseAdmin }));
vi.mock("@/app/system/forms/payroll-notice/_lib/chatwork-token-sync.server", () => ({
  isValidChatworkApiToken: mocks.isValidChatworkApiToken,
}));
vi.mock("@/app/system/_lib/chatwork", () => ({ getChatworkMe: mocks.getChatworkMe }));
vi.mock("@/app/rill/mail/_lib/token-crypto", () => ({ encryptToken: mocks.encryptToken }));

const TOKEN = ["01234567", "89abcdef", "01234567", "89abcdef"].join("");
const context = { params: Promise.resolve({ employeeId: "EMP-9001" }) };

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/root/employees/EMP-9001/chatwork-token", {
    method,
    body: body == null ? undefined : JSON.stringify(body),
  });
}

describe("root employee chatwork token route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.requireManager.mockResolvedValue({ userId: "user-1", employee_number: "0001" });
    mocks.isValidChatworkApiToken.mockReturnValue(true);
    mocks.getChatworkMe.mockResolvedValue({ name: "金亜奈", accountId: "cw-1" });
    mocks.encryptToken.mockReturnValue("encrypted-token");
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { PUT } = await import("./route");

    const response = await PUT(request("PUT", { token: TOKEN }), context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe("責任者以上の権限が必要です");
    expect(mocks.getChatworkMe).not.toHaveBeenCalled();
  });

  it("returns status without returning a token", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        chatwork_api_token_enc: "encrypted-token",
        chatwork_account_name: "金亜奈",
        chatwork_token_updated_at: "2026-09-07T10:38:00.000Z",
      },
      error: null,
    });
    mocks.getSupabaseAdmin.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ is: () => ({ maybeSingle }) }),
        }),
      }),
    });
    const { GET } = await import("./route");

    const response = await GET(request("GET"), context);
    const body = await response.json();

    expect(body).toEqual({
      registered: true,
      accountName: "金亜奈",
      updatedAt: "2026-09-07T10:38:00.000Z",
    });
    expect(JSON.stringify(body)).not.toContain("encrypted-token");
    expect(JSON.stringify(body)).not.toContain(TOKEN);
  });

  it("rejects invalid format before Chatwork verification", async () => {
    mocks.isValidChatworkApiToken.mockReturnValue(false);
    const { PUT } = await import("./route");

    const response = await PUT(request("PUT", { token: "bad" }), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Chatwork の API トークンの形ではありません（半角 32 文字）");
    expect(mocks.getChatworkMe).not.toHaveBeenCalled();
  });

  it("rejects tokens that Chatwork does not accept", async () => {
    mocks.getChatworkMe.mockRejectedValueOnce(new Error("401"));
    const { PUT } = await import("./route");

    const response = await PUT(request("PUT", { token: TOKEN }), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Chatwork が受け付けませんでした。トークンを確認してください");
  });

  it("stores encrypted token, account name, and timestamp without leaking the token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T10:38:00.000Z"));
    const updates: unknown[] = [];
    const inserts: unknown[] = [];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === "root_audit_log") {
          return { insert: (payload: unknown) => inserts.push(payload) };
        }
        return {
          update: (payload: unknown) => {
            updates.push(payload);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          },
        };
      },
    });
    const { PUT } = await import("./route");

    const response = await PUT(request("PUT", { token: TOKEN }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.getChatworkMe).toHaveBeenCalledWith(TOKEN);
    expect(updates[0]).toEqual({
      chatwork_api_token_enc: "encrypted-token",
      chatwork_account_name: "金亜奈",
      chatwork_token_updated_at: "2026-09-07T10:38:00.000Z",
    });
    expect(body).toEqual({
      ok: true,
      accountName: "金亜奈",
      updatedAt: "2026-09-07T10:38:00.000Z",
    });
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(JSON.stringify(inserts)).not.toContain(TOKEN);
    expect(inserts[0]).toMatchObject({
      action: "master_update",
      target_id: "EMP-9001",
      payload: { action: "Chatwork トークン登録" },
    });
  });

  it("clears all token columns on delete", async () => {
    const updates: unknown[] = [];
    mocks.getSupabaseAdmin.mockReturnValue({
      from: (table: string) => {
        if (table === "root_audit_log") return { insert: vi.fn() };
        return {
          update: (payload: unknown) => {
            updates.push(payload);
            return { eq: vi.fn().mockResolvedValue({ error: null }) };
          },
        };
      },
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(request("DELETE"), context);

    expect(response.status).toBe(200);
    expect(updates[0]).toEqual({
      chatwork_api_token_enc: null,
      chatwork_account_name: null,
      chatwork_token_updated_at: null,
    });
  });
});
