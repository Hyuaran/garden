import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getLatestRosterSyncLog: vi.fn(),
  syncRootRoster: vi.fn(),
}));

vi.mock("@/app/system/mypage/_lib/submission-server", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/app/root/_lib/roster-sync.server", () => ({
  getLatestRosterSyncLog: mocks.getLatestRosterSyncLog,
  syncRootRoster: mocks.syncRootRoster,
}));

describe("root roster sync route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.requireAdmin.mockReset();
    mocks.getLatestRosterSyncLog.mockReset();
    mocks.syncRootRoster.mockReset();
  });

  it("rejects non-admin users", async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/root/roster-sync", { method: "POST" }));

    expect(response.status).toBe(403);
    expect(mocks.syncRootRoster).not.toHaveBeenCalled();
  });

  it("runs apply sync for admins when dryRun is false", async () => {
    mocks.requireAdmin.mockResolvedValue({ employee_id: "EMP-1" });
    mocks.syncRootRoster.mockResolvedValue({ ok: true, dryRun: false, rosterRecords: 1 });
    const { POST } = await import("./route");

    const response = await POST(new Request("http://localhost/api/root/roster-sync", {
      method: "POST",
      body: JSON.stringify({ dryRun: false }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.syncRootRoster).toHaveBeenCalledWith({ dryRun: false });
  });

  it("returns latest sync log", async () => {
    mocks.requireAdmin.mockResolvedValue({ employee_id: "EMP-1" });
    mocks.getLatestRosterSyncLog.mockResolvedValue({ id: 1 });
    const { GET } = await import("./route");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.latest).toEqual({ id: 1 });
  });
});
