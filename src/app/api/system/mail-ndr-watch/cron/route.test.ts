import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/mail-ndr-watch/service", () => ({ runMailNdrWatch: vi.fn(async () => ({ ok: true, alerts: [] })) }));
import { runMailNdrWatch } from "@/lib/mail-ndr-watch/service";
import { GET } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("NDR cron", () => {
  it("rejects missing auth without executing", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    expect((await GET(new Request("http://localhost/api/system/mail-ndr-watch/cron"))).status).toBe(401);
    expect(runMailNdrWatch).not.toHaveBeenCalled();
  });
  it("passes dryRun only after bearer authentication", async () => {
    vi.stubEnv("CRON_SECRET", "test-secret");
    const response = await GET(new Request("http://localhost/api/system/mail-ndr-watch/cron?dryRun=1", { headers: { authorization: "Bearer test-secret" } }));
    expect(response.status).toBe(200); expect(runMailNdrWatch).toHaveBeenCalledWith(true);
  });
});
