import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runMailPaymentCheck: vi.fn(),
  allowAdminDryRun: vi.fn(),
}));

vi.mock("@/lib/mail-payment-check/run", () => ({ runMailPaymentCheck: mocks.runMailPaymentCheck }));
vi.mock("@/lib/pl-payments/admin-dry-run", () => ({ allowAdminDryRun: mocks.allowAdminDryRun }));

import { GET } from "./route";

describe("/api/system/mail-payment-check/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "secret";
    mocks.runMailPaymentCheck.mockResolvedValue({ ok: true, applied: true });
    mocks.allowAdminDryRun.mockResolvedValue(false);
  });

  it("合言葉が正しければ本運転", async () => {
    const response = await GET(new Request("http://test/api/system/mail-payment-check/cron", { headers: { authorization: "Bearer secret" } }));
    expect(response.status).toBe(200);
    expect(mocks.runMailPaymentCheck).toHaveBeenCalledWith({ apply: true, trigger: "cron", force: false });
  });

  it("合言葉が無ければ動かない", async () => {
    const response = await GET(new Request("http://test/api/system/mail-payment-check/cron"));
    expect(response.status).not.toBe(200);
    expect(mocks.runMailPaymentCheck).not.toHaveBeenCalled();
  });
});
