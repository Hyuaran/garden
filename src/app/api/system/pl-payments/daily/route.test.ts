import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runPlPaymentsDaily: vi.fn(),
}));

vi.mock("@/lib/pl-payments/run", () => ({
  runPlPaymentsDaily: mocks.runPlPaymentsDaily,
}));

import { GET } from "./route";

describe("/api/system/pl-payments/daily", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
    mocks.runPlPaymentsDaily.mockResolvedValue({ ok: true, applied: true });
  });

  it("runs when bearer token is valid", async () => {
    const response = await GET(new Request("http://test/api/system/pl-payments/daily", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.runPlPaymentsDaily).toHaveBeenCalledWith({ apply: true, trigger: "daily" });
  });
});
