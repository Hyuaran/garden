import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyCronRequest: vi.fn(),
  syncRootRoster: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronRequest: mocks.verifyCronRequest }));
vi.mock("@/app/root/_lib/roster-sync.server", () => ({ syncRootRoster: mocks.syncRootRoster }));

describe("root roster sync cron route", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.verifyCronRequest.mockReset();
    mocks.syncRootRoster.mockReset();
  });

  it("rejects invalid cron requests", async () => {
    mocks.verifyCronRequest.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/root/roster-sync/cron"));

    expect(response.status).toBe(401);
    expect(mocks.syncRootRoster).not.toHaveBeenCalled();
  });

  it("runs apply sync for valid cron requests", async () => {
    mocks.verifyCronRequest.mockReturnValue({ ok: true });
    mocks.syncRootRoster.mockResolvedValue({ ok: true, dryRun: false });
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/root/roster-sync/cron"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mocks.syncRootRoster).toHaveBeenCalledWith({ dryRun: false });
  });
});
