import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  completeRelayJob: vi.fn(),
}));

vi.mock("@/lib/relay/queue.server", () => ({
  completeRelayJob: mocks.completeRelayJob,
}));

import { POST } from "./route";

function request(token = "relay-secret", body: unknown = { id: "job-1", ok: true }) {
  return new Request("http://localhost/api/system/relay/result", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

describe("POST /api/system/relay/result", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RELAY_SECRET = "relay-secret";
    mocks.completeRelayJob.mockResolvedValue(true);
  });

  it("rejects missing and invalid relay secrets", async () => {
    delete process.env.RELAY_SECRET;
    expect((await POST(request())).status).toBe(500);
    process.env.RELAY_SECRET = "relay-secret";
    expect((await POST(request("wrong"))).status).toBe(401);
  });

  it("records a successful result", async () => {
    const response = await POST(request("relay-secret", { id: "job-1", ok: true, result: { result: true, data: [] } }));
    expect(response.status).toBe(200);
    expect(mocks.completeRelayJob).toHaveBeenCalledWith("job-1", { ok: true, result: { result: true, data: [] }, error: undefined });
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("returns 404 when the job is missing", async () => {
    mocks.completeRelayJob.mockResolvedValue(false);
    const response = await POST(request());
    expect(response.status).toBe(404);
  });

  it("returns 500 on store errors", async () => {
    mocks.completeRelayJob.mockRejectedValue(new Error("db down"));
    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: "db down" });
  });
});
