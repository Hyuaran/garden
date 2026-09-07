import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireManager: vi.fn(),
  syncChatworkTokens: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireManager: mocks.requireManager }));
vi.mock("@/app/system/payroll-notice/_lib/chatwork-token-sync.server", () => ({ syncChatworkTokens: mocks.syncChatworkTokens }));

describe("root chatwork token sync route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireManager.mockReset();
    mocks.syncChatworkTokens.mockReset();
  });

  it("rejects users below manager", async () => {
    mocks.requireManager.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/root/chatwork-token-sync", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(mocks.syncChatworkTokens).not.toHaveBeenCalled();
  });

  it("runs sync for managers", async () => {
    mocks.requireManager.mockResolvedValue({ employee_id: "emp-1" });
    mocks.syncChatworkTokens.mockResolvedValue({ ok: true, imported: 0 });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/root/chatwork-token-sync", {
      method: "POST",
      body: JSON.stringify({ kotEmployeeId: "1001" }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.syncChatworkTokens).toHaveBeenCalledWith({ kotEmployeeId: "1001" });
  });
});
