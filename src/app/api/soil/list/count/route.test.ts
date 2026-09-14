import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  hasDatabaseUrl: vi.fn(),
  queryPg: vi.fn(),
}));

vi.mock("../_lib/auth", () => ({
  requireSoilListUser: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/db/pg", () => ({
  hasDatabaseUrl: () => mocks.hasDatabaseUrl(),
  queryPg: (text: string, values: unknown[]) => mocks.queryPg(text, values),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

import { POST } from "./route";

function thenableCount(count: number) {
  return {
    eq: vi.fn(function (this: unknown) { return this; }),
    neq: vi.fn(function (this: unknown) { return this; }),
    gte: vi.fn(function (this: unknown) { return this; }),
    lte: vi.fn(function (this: unknown) { return this; }),
    ilike: vi.fn(function (this: unknown) { return this; }),
    in: vi.fn(function (this: unknown) { return this; }),
    not: vi.fn(function (this: unknown) { return this; }),
    or: vi.fn(function (this: unknown) { return this; }),
    order: vi.fn(function (this: unknown) { return this; }),
    range: vi.fn(function (this: unknown) { return this; }),
    limit: vi.fn(function (this: unknown) { return this; }),
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(resolve({ data: null, error: null, count }));
    },
  };
}

describe("soil list count route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(false);
  });

  it("uses PostgreSQL count when DATABASE_URL is configured", async () => {
    mocks.hasDatabaseUrl.mockReturnValue(true);
    mocks.queryPg.mockResolvedValue({ rows: [{ count: "42" }] });

    const response = await POST(new Request("http://localhost/api/soil/list/count", {
      method: "POST",
      body: JSON.stringify({ condition: { filters: [{ field: "prefecture", op: "eq", value: "奈良県" }] } }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, count: 42, approximate: false });
    expect(mocks.queryPg).toHaveBeenCalledWith(expect.stringContaining("select count(*)::bigint as count"), ["奈良県"]);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("falls back to the REST count when DATABASE_URL is not configured", async () => {
    const query = thenableCount(7);
    const select = vi.fn(() => query);
    mocks.from.mockReturnValue({ select });

    const response = await POST(new Request("http://localhost/api/soil/list/count", {
      method: "POST",
      body: JSON.stringify({ condition: { filters: [{ field: "appointmentBlocked", op: "empty" }] } }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, count: 7, approximate: false });
    expect(mocks.from).toHaveBeenCalledWith("soil_list_phone");
    expect(select).toHaveBeenCalledWith("電話番号", { count: "exact", head: true });
    expect(query.or).toHaveBeenCalledWith("アポ禁.is.null,アポ禁.eq.");
    expect(mocks.queryPg).not.toHaveBeenCalled();
  });
});
