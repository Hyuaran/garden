import "@/lib/auth/__tests__/system-view-fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runInnoveraSync: vi.fn(),
  checkRelayHeartbeat: vi.fn(),
}));

vi.mock("@/lib/innovera/sync.server", () => ({
  runInnoveraSync: mocks.runInnoveraSync,
}));

vi.mock("@/lib/relay/monitor.server", () => ({
  checkRelayHeartbeat: mocks.checkRelayHeartbeat,
}));

import { GET } from "./route";

function request(secret?: string) {
  return new Request("http://test/api/system/innovera-sync/cron", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : undefined,
  });
}

describe("/api/system/innovera-sync/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mocks.checkRelayHeartbeat.mockResolvedValue({ ok: true, checked: true });
    mocks.runInnoveraSync.mockResolvedValue({
      ok: true,
      applied: true,
      trigger: "cron",
      ranAt: "2026-10-07T05:35:00.000Z",
      innoveraCount: 1,
      kintoneCount: 1,
      counts: { added: 0, renamed: 0, retired: 0, needsReview: 0, failed: 0 },
      actions: [],
      details: [],
    });
  });

  it("rejects requests without a bearer token", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.runInnoveraSync).not.toHaveBeenCalled();
  });

  it("runs when the bearer token is valid", async () => {
    const response = await GET(request("cron-secret"));
    expect(response.status).toBe(200);
    expect(mocks.checkRelayHeartbeat).toHaveBeenCalledTimes(1);
    expect(mocks.runInnoveraSync).toHaveBeenCalledWith({ apply: true, trigger: "cron" });
    await expect(response.json()).resolves.toMatchObject({ ok: true, applied: true });
  });

  it("continues the sync even when heartbeat monitoring fails", async () => {
    mocks.checkRelayHeartbeat.mockRejectedValue(new Error("monitor failed"));
    const response = await GET(request("cron-secret"));
    expect(response.status).toBe(200);
    expect(mocks.runInnoveraSync).toHaveBeenCalledWith({ apply: true, trigger: "cron" });
  });
});
