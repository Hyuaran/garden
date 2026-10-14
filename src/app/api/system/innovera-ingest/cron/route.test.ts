import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyCronRequest: vi.fn(),
  getCronRange: vi.fn(),
  runInnoveraIngest: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronRequest: (...args: unknown[]) => mocks.verifyCronRequest(...args) }));
vi.mock("@/lib/innovera/ingest.server", () => ({
  getCronRange: (...args: unknown[]) => mocks.getCronRange(...args),
  runInnoveraIngest: (...args: unknown[]) => mocks.runInnoveraIngest(...args),
}));

import { GET } from "./route";

describe("GET /api/system/innovera-ingest/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronRequest.mockReturnValue({ ok: true });
    mocks.getCronRange.mockResolvedValue({ from: new Date("2026-10-13T00:00:00Z"), to: new Date("2026-10-13T01:00:00Z") });
    mocks.runInnoveraIngest.mockResolvedValue({ ok: true, fetched: 1 });
  });

  it("rejects invalid cron auth", async () => {
    mocks.verifyCronRequest.mockReturnValue({ ok: false, status: 401, reason: "Invalid token" });
    const response = await GET(new Request("http://test/api/system/innovera-ingest/cron"));
    expect(response.status).toBe(401);
    expect(mocks.runInnoveraIngest).not.toHaveBeenCalled();
  });

  it("runs poll ingest for the computed range", async () => {
    const response = await GET(new Request("http://test/api/system/innovera-ingest/cron"));
    expect(response.status).toBe(200);
    expect(mocks.runInnoveraIngest).toHaveBeenCalledWith({
      mode: "poll",
      from: new Date("2026-10-13T00:00:00Z"),
      to: new Date("2026-10-13T01:00:00Z"),
    });
  });
});
