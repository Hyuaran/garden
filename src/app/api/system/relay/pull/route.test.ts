import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  touchRelayHeartbeat: vi.fn(),
  pullRelayJob: vi.fn(),
}));

vi.mock("@/lib/relay/queue.server", () => ({
  touchRelayHeartbeat: mocks.touchRelayHeartbeat,
  pullRelayJob: mocks.pullRelayJob,
}));

import { POST } from "./route";

function request(token = "relay-secret", body: unknown = {}) {
  return new Request("http://localhost/api/system/relay/pull", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe("POST /api/system/relay/pull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELAY_SECRET = "relay-secret";
    mocks.touchRelayHeartbeat.mockResolvedValue({});
    mocks.pullRelayJob.mockResolvedValue(null);
  });

  it("rejects missing and invalid relay secrets", async () => {
    delete process.env.RELAY_SECRET;
    expect((await POST(request())).status).toBe(500);
    process.env.RELAY_SECRET = "relay-secret";
    expect((await POST(request("wrong"))).status).toBe(401);
  });

  it("touches heartbeat and returns a job", async () => {
    mocks.pullRelayJob.mockResolvedValue({
      id: "job-1",
      kind: "innovera",
      request: { ckey: "cdr", akey: "search", params: { page: 1 } },
    });
    const response = await POST(request("relay-secret", { agentVersion: "v1", waitMs: 40_000 }));
    expect(response.status).toBe(200);
    expect(mocks.touchRelayHeartbeat).toHaveBeenCalledWith("v1");
    expect(mocks.pullRelayJob).toHaveBeenCalledWith({ waitMs: 25_000 });
    await expect(response.json()).resolves.toMatchObject({ ok: true, job: { id: "job-1", kind: "innovera" } });
  });

  it("returns 500 on store errors", async () => {
    mocks.pullRelayJob.mockRejectedValue(new Error("db down"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "db down" });
  });
});
