import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  hasDatabaseUrl: vi.fn(),
}));

vi.mock("../_lib/auth", () => ({
  requireSoilListUser: vi.fn(async () => ({ ok: true })),
}));

vi.mock("@/lib/db/pg", () => ({
  hasDatabaseUrl: () => mocks.hasDatabaseUrl(),
  getPgPool: () => {
    throw new Error("pg_not_expected");
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: mocks.from }),
}));

import { normalizeTableCounts } from "../_lib/table-counts";
import { GET } from "./route";

describe("table counts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasDatabaseUrl.mockReturnValue(false);
  });

  it("normalizes rows and uses the oldest counted_at", () => {
    expect(normalizeTableCounts([
      { table_name: "soil_list_phone", row_count: "2675537", counted_at: "2026-09-28T00:00:00Z" },
      { table_name: "soil_list_call", row_count: 1190000, counted_at: "2026-09-27T21:55:00Z" },
    ])).toEqual({
      counts: { phone: 2675537, purchase: null, assignment: null, call: 1190000, order: null },
      countedAt: "2026-09-27T21:55:00Z",
    });
  });

  it("returns stored table counts through the route", async () => {
    mocks.from.mockReturnValue({
      select: async () => ({
        data: [
          { table_name: "soil_list_phone", row_count: "2675537", counted_at: "2026-09-28T00:00:00Z" },
          { table_name: "soil_list_purchase", row_count: "2420000", counted_at: "2026-09-28T00:00:01Z" },
          { table_name: "soil_list_assignment", row_count: "41000", counted_at: "2026-09-28T00:00:02Z" },
          { table_name: "soil_list_call", row_count: "1190000", counted_at: "2026-09-28T00:00:03Z" },
          { table_name: "soil_list_order", row_count: "21000", counted_at: "2026-09-28T00:00:04Z" },
        ],
        error: null,
      }),
    });

    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      counts: { phone: 2675537, purchase: 2420000, assignment: 41000, call: 1190000, order: 21000 },
      countedAt: "2026-09-28T00:00:00Z",
    });
  });
});
