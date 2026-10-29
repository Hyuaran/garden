import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/mf-stop-notice/run.server", () => ({ runMfStopNoticeCron: vi.fn() }));
import { runMfStopNoticeCron } from "@/lib/mf-stop-notice/run.server";
import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});
afterEach(() => vi.unstubAllEnvs());

it("rejects unauthorized requests before loading employees, including dryRun", async () => {
  const response = await GET(new Request("https://example.com/api/system/mf-stop-notice/cron?dryRun=1"));
  expect(response.status).toBe(401);
  expect(runMfStopNoticeCron).not.toHaveBeenCalled();
});

it("passes authorized dryRun to the runner", async () => {
  vi.mocked(runMfStopNoticeCron).mockResolvedValue({ ok: true, dryRun: true, targets: [], notified: 0 });
  const response = await GET(new Request("https://example.com/api/system/mf-stop-notice/cron?dryRun=1", { headers: { Authorization: "Bearer test-secret" } }));
  expect(response.status).toBe(200);
  expect(runMfStopNoticeCron).toHaveBeenCalledExactlyOnceWith(true);
});

it("returns failure when sending or recording fails", async () => {
  vi.mocked(runMfStopNoticeCron).mockRejectedValue(new Error("failed"));
  const response = await GET(new Request("https://example.com/api/system/mf-stop-notice/cron", { headers: { Authorization: "Bearer test-secret" } }));
  expect(response.status).toBe(500);
});
