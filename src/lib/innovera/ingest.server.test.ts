import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callInnovera: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/innovera/client", () => ({ callInnovera: mocks.callInnovera }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => mocks.getAdmin() }));

import { fetchInnoveraCdrRange, getCronRange, getDailyRange, runInnoveraIngest } from "./ingest.server";

function supabase() {
  const insertedLogs: unknown[] = [];
  const upserts: unknown[] = [];
  return {
    insertedLogs,
    upserts,
    from(table: string) {
      if (table === "system_innovera_call") {
        return { upsert: async (rows: unknown) => { upserts.push(rows); return { error: null }; } };
      }
      if (table === "system_innovera_ingest_log") {
        return {
          insert: async (row: unknown) => { insertedLogs.push(row); return { error: null }; },
          select: () => ({
            eq: () => ({
              // poll／daily の記録だけを見る（backfill は除く）
              in: (column: string, modes: string[]) => {
                expect(column).toBe("mode");
                expect(modes).toEqual(["poll", "daily"]);
                return {
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: { range_to: "2026-10-14T02:00:00.000Z" }, error: null }),
                    }),
                  }),
                };
              },
            }),
          }),
        };
      }
      throw new Error(table);
    },
  };
}

describe("INNOVERA ingest server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches 1000-row pages until a short page", async () => {
    mocks.callInnovera
      .mockResolvedValueOnce(Array.from({ length: 1000 }, (_, id) => ({ id: String(id), start_time: "2026-10-13 09:00:00" })))
      .mockResolvedValueOnce([{ id: "last", start_time: "2026-10-13 10:00:00" }]);
    const rows = await fetchInnoveraCdrRange(new Date("2026-10-13T00:00:00Z"), new Date("2026-10-13T01:00:00Z"));
    expect(rows).toHaveLength(1001);
    expect(mocks.callInnovera).toHaveBeenNthCalledWith(1, "cdr", "search", expect.objectContaining({ page: 1, limit: 1000 }));
    expect(mocks.callInnovera).toHaveBeenNthCalledWith(2, "cdr", "search", expect.objectContaining({ page: 2, limit: 1000 }));
  });

  it("logs success and upserts in 500-row batches", async () => {
    mocks.callInnovera.mockResolvedValue(Array.from({ length: 501 }, (_, id) => ({ id: String(id), start_time: "2026-10-13 09:00:00" })));
    const client = supabase();
    const result = await runInnoveraIngest({
      mode: "poll",
      from: new Date("2026-10-13T00:00:00Z"),
      to: new Date("2026-10-13T01:00:00Z"),
      supabase: client as never,
      runId: "run-1",
    });
    expect(result).toMatchObject({ ok: true, fetched: 501, sent: 501, upserted: 501, skipped: 0 });
    expect(client.upserts.map((rows) => (rows as unknown[]).length)).toEqual([500, 1]);
    expect(client.insertedLogs.at(-1)).toMatchObject({ run_id: "run-1", status: "success" });
  });

  it("records failed logs but returns 200-shaped failure payloads", async () => {
    mocks.callInnovera.mockRejectedValue(new Error("INNOVERA HTTP 429"));
    const client = supabase();
    const result = await runInnoveraIngest({
      mode: "poll",
      from: new Date("2026-10-13T00:00:00Z"),
      to: new Date("2026-10-13T01:00:00Z"),
      supabase: client as never,
      runId: "run-fail",
    });
    expect(result).toMatchObject({ ok: false, error: "INNOVERA HTTP 429" });
    expect(client.insertedLogs.at(-1)).toMatchObject({ run_id: "run-fail", status: "failed" });
  });

  it("uses last successful range_to minus 180 minutes for cron range", async () => {
    const range = await getCronRange(supabase() as never, new Date("2026-10-14T04:00:00.000Z"));
    expect(range.from.toISOString()).toBe("2026-10-13T23:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-14T04:00:00.000Z");
  });

  it("builds the daily reread range as previous JST midnight to current JST 03:00", () => {
    const range = getDailyRange(new Date("2026-10-14T01:00:00.000Z"));
    expect(range.from.toISOString()).toBe("2026-10-12T15:00:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-13T18:00:00.000Z");
  });
});
