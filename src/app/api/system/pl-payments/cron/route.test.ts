import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runPlPaymentsCron: vi.fn(),
}));

vi.mock("@/lib/pl-payments/run", () => ({
  runPlPaymentsCron: mocks.runPlPaymentsCron,
}));

import { GET } from "./route";

describe("/api/system/pl-payments/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
    mocks.runPlPaymentsCron.mockResolvedValue({ ok: true, applied: false });
  });

  it("rejects missing bearer token", async () => {
    const response = await GET(new Request("http://test/api/system/pl-payments/cron"));
    expect(response.status).toBe(401);
    expect(mocks.runPlPaymentsCron).not.toHaveBeenCalled();
  });

  it("runs dry mode", async () => {
    const response = await GET(new Request("http://test/api/system/pl-payments/cron?dry=1", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.runPlPaymentsCron).toHaveBeenCalledWith({ apply: false, trigger: "cron" });
  });
});
