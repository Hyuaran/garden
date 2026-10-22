import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  exportCalls: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyBearerRequest: (...args: unknown[]) => mocks.verify(...args) }));
vi.mock("@/lib/innovera/export.server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/innovera/export.server")>();
  return { ...actual, exportInnoveraCalls: (...args: unknown[]) => mocks.exportCalls(...args) };
});

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://test/api/system/innovera-calls/export", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = { circuits: [164, 165], from: "2026-10-19 00:00:00", to: "2026-10-22 23:59:59" };

describe("POST /api/system/innovera-calls/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue({ ok: true });
    mocks.exportCalls.mockResolvedValue({ rows: [{ id: "1" }], covered_until: "2026-10-22T05:55:00.000Z", last_success_at: "2026-10-22T05:55:03.000Z" });
  });

  it("checks the WEB inbound export secret and rejects unauthenticated requests", async () => {
    mocks.verify.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const response = await POST(request(VALID));
    expect(mocks.verify).toHaveBeenCalledWith(expect.any(Request), "WEB_INBOUND_EXPORT_SECRET");
    expect(response.status).toBe(401);
    expect(mocks.exportCalls).not.toHaveBeenCalled();
  });

  it("rejects invalid bodies with 400", async () => {
    expect((await POST(request("not json"))).status).toBe(400);
    expect((await POST(request({ ...VALID, circuits: [] }))).status).toBe(400);
    expect((await POST(request({ ...VALID, from: "2026-10-23 00:00:00" }))).status).toBe(400);
    expect(mocks.exportCalls).not.toHaveBeenCalled();
  });

  it("returns the rows and the ingest coverage", async () => {
    const response = await POST(request(VALID));
    expect(response.status).toBe(200);
    expect(mocks.exportCalls).toHaveBeenCalledWith(VALID);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      rows: [{ id: "1" }],
      covered_until: "2026-10-22T05:55:00.000Z",
      last_success_at: "2026-10-22T05:55:03.000Z",
    });
  });

  it("returns 500 without details when reading fails", async () => {
    mocks.exportCalls.mockRejectedValue(new Error("system_innovera_call select failed: boom"));
    const response = await POST(request(VALID));
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "通話履歴を読めませんでした" });
  });
});
