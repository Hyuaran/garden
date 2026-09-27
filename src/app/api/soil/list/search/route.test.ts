import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasDatabaseUrl: vi.fn(),
  queryPg: vi.fn(),
  queryPgWithTimeout: vi.fn(),
}));

vi.mock("../_lib/auth", () => ({
  requireSoilListUser: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../_lib/query", () => ({
  toSearchRow: (row: Record<string, unknown>) => row,
}));

vi.mock("@/lib/db/pg", () => ({
  hasDatabaseUrl: () => mocks.hasDatabaseUrl(),
  queryPg: (text: string, values: unknown[]) => mocks.queryPg(text, values),
  queryPgWithTimeout: (text: string, values: unknown[], timeoutMs: number) => mocks.queryPgWithTimeout(text, values, timeoutMs),
}));

import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/soil/list/search", {
    method: "POST",
    body: JSON.stringify({
      condition: { filters: [{ field: "prefecture", op: "eq", value: "Osaka" }] },
      sort: { key: "phoneNumber", direction: "asc" },
      page: 1,
    }),
  });
}

describe("soil list search route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(true);
  });

  it("uses filter-first SQL when EXPLAIN estimates fewer rows than the threshold", async () => {
    mocks.queryPg
      .mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [{ Plan: { "Plan Rows": 12345 } }] }] })
      .mockResolvedValueOnce({ rows: [{ phone: "1" }] });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.queryPg).toHaveBeenNthCalledWith(1, expect.stringContaining("explain (format json)"), ["Osaka"]);
    expect(mocks.queryPg).toHaveBeenNthCalledWith(2, expect.stringContaining("with m as materialized"), ["Osaka"]);
  });

  it("falls back to the normal search SQL when EXPLAIN fails", async () => {
    mocks.queryPg.mockRejectedValueOnce(new Error("explain_failed"));
    mocks.queryPgWithTimeout.mockResolvedValueOnce({ rows: [] });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.queryPgWithTimeout).toHaveBeenCalledWith(expect.not.stringContaining("with m as materialized"), ["Osaka"], 8000);
  });

  it("uses the normal search SQL with an 8 second limit when the estimate is large", async () => {
    mocks.queryPg.mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [{ Plan: { "Plan Rows": 1900000 } }] }] });
    mocks.queryPgWithTimeout.mockResolvedValueOnce({ rows: [{ phone: "1" }] });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.queryPgWithTimeout).toHaveBeenCalledWith(expect.stringContaining("order by"), ["Osaka"], 8000);
    expect(mocks.queryPg).toHaveBeenCalledTimes(1);
  });

  it("retries with filter-first SQL when the normal search is cut off", async () => {
    mocks.queryPg
      .mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [{ Plan: { "Plan Rows": 1900000 } }] }] })
      .mockResolvedValueOnce({ rows: [{ phone: "1" }] });
    mocks.queryPgWithTimeout.mockRejectedValueOnce(Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.queryPg).toHaveBeenNthCalledWith(2, expect.stringContaining("with m as materialized"), ["Osaka"]);
  });

  it("does not retry other database errors", async () => {
    mocks.queryPg.mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [{ Plan: { "Plan Rows": 1900000 } }] }] });
    mocks.queryPgWithTimeout.mockRejectedValueOnce(Object.assign(new Error("boom"), { code: "XX000" }));

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(mocks.queryPg).toHaveBeenCalledTimes(1);
  });
});
