import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyCronRequest: vi.fn(),
  getDailyRange: vi.fn(),
  runInnoveraIngest: vi.fn(),
}));

vi.mock("@/lib/cron-auth", () => ({ verifyCronRequest: (...args: unknown[]) => mocks.verifyCronRequest(...args) }));
vi.mock("@/lib/innovera/ingest.server", () => ({
  getDailyRange: (...args: unknown[]) => mocks.getDailyRange(...args),
  runInnoveraIngest: (...args: unknown[]) => mocks.runInnoveraIngest(...args),
}));

import { GET } from "./route";

describe("GET /api/system/innovera-ingest/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyCronRequest.mockReturnValue({ ok: true });
    mocks.getDailyRange.mockReturnValue({ from: new Date("2026-10-12T15:00:00Z"), to: new Date("2026-10-13T18:00:00Z") });
    mocks.runInnoveraIngest.mockResolvedValue({ ok: true, fetched: 1 });
  });

  it("runs daily ingest for the deep-night reread range", async () => {
    const response = await GET(new Request("http://test/api/system/innovera-ingest/daily"));
    expect(response.status).toBe(200);
    expect(mocks.runInnoveraIngest).toHaveBeenCalledWith({
      mode: "daily",
      from: new Date("2026-10-12T15:00:00Z"),
      to: new Date("2026-10-13T18:00:00Z"),
    });
  });
});
