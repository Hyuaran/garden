import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshListOptions: vi.fn(),
  refreshTableCounts: vi.fn(),
}));

vi.mock("../../analysis/_lib/analysis", () => ({
  refreshListOptions: () => mocks.refreshListOptions(),
}));

vi.mock("../../_lib/table-counts", () => ({
  refreshTableCounts: () => mocks.refreshTableCounts(),
}));

import { GET } from "./route";

function request(secret = "secret") {
  return new Request("http://localhost/api/soil/list/options/cron", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("/api/soil/list/options/cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "secret");
    mocks.refreshListOptions.mockResolvedValue({ optionsRefreshed: true });
    mocks.refreshTableCounts.mockResolvedValue({ tableCountsRefreshed: true });
  });

  it("returns 401 when CRON_SECRET does not match", async () => {
    const response = await GET(request("wrong"));
    expect(response.status).toBe(401);
    expect(mocks.refreshListOptions).not.toHaveBeenCalled();
    expect(mocks.refreshTableCounts).not.toHaveBeenCalled();
  });

  it("refreshes options and table counts", async () => {
    const response = await GET(request());
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      optionsRefreshed: true,
      tableCountsRefreshed: true,
    });
    expect(response.status).toBe(200);
  });

  it("still refreshes table counts when options fail and returns 500", async () => {
    mocks.refreshListOptions.mockRejectedValue(new Error("options_failed"));

    const response = await GET(request());
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      optionsRefreshed: false,
      optionsRefreshError: "options_failed",
      tableCountsRefreshed: true,
    });
    expect(response.status).toBe(500);
    expect(mocks.refreshTableCounts).toHaveBeenCalled();
  });
});
