import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  ingest: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyBearerRequest: (...args: unknown[]) => mocks.verify(...args) }));
vi.mock("@/lib/innovera/ingest", () => ({ ingestInnoveraRows: (...args: unknown[]) => mocks.ingest(...args) }));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://test/api/system/innovera-ingest", {
    method: "POST",
    headers: { authorization: "Bearer secret", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/system/innovera-ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verify.mockReturnValue({ ok: true });
    mocks.ingest.mockResolvedValue({ ok: true, received: 1, upserted: 1, skipped: 0 });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.verify.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const response = await POST(request({ rows: [] }));
    expect(response.status).toBe(401);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("rejects batches over 500 rows", async () => {
    const response = await POST(request({ rows: Array.from({ length: 501 }, (_, id) => ({ id })) }));
    expect(response.status).toBe(400);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it("passes rows to the shared ingest function", async () => {
    const response = await POST(request({ rows: [{ id: "1" }], mode: "backfill", run_id: "run-1" }));
    expect(response.status).toBe(200);
    expect(mocks.ingest).toHaveBeenCalledWith([{ id: "1" }]);
    await expect(response.json()).resolves.toEqual({ ok: true, received: 1, upserted: 1, skipped: 0 });
  });
});
