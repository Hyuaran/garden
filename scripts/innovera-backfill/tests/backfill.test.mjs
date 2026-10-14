import { describe, expect, it } from "vitest";

import { chunks, fetchInnoveraDay, nextDate, postIngest, splitDays } from "../backfill.mjs";

describe("innovera backfill helpers", () => {
  it("splits an inclusive date range into daily units", () => {
    expect(splitDays("2026-01-01", "2026-01-03")).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(nextDate("2026-01-31")).toBe("2026-02-01");
  });

  it("chunks ingest payloads at 500 rows", () => {
    const rows = Array.from({ length: 1001 }, (_, id) => ({ id }));
    expect(chunks(rows).map((chunk) => chunk.length)).toEqual([500, 500, 1]);
  });

  it("fetches INNOVERA pages until a short page", async () => {
    const calls = [];
    const fetchImpl = async (_url, init) => {
      calls.push(Object.fromEntries(init.body.entries()));
      const page = Number(calls.at(-1).page);
      return new Response(JSON.stringify({
        result: true,
        data: Array.from({ length: page === 1 ? 1000 : 2 }, (_, id) => ({ id: `${page}-${id}` })),
      }));
    };
    const rows = await fetchInnoveraDay("2026-01-01", {
      INNOVERA_API_HOST: "example.test",
      INNOVERA_API_KEY: "key",
    }, fetchImpl);
    expect(rows).toHaveLength(1002);
    expect(calls.map((call) => call.page)).toEqual(["1", "2"]);
    expect(calls[0]).toMatchObject({ limit: "1000", start_time_start: "2026-01-01 00:00:00" });
  });

  it("posts ingest batches and accumulates counts", async () => {
    const requests = [];
    const fetchImpl = async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      return new Response(JSON.stringify({ upserted: body.rows.length - 1, skipped: 1 }));
    };
    const result = await postIngest("https://garden.example", "secret", Array.from({ length: 501 }, (_, id) => ({ id })), "run-1", fetchImpl);
    expect(requests.map((body) => body.rows.length)).toEqual([500, 1]);
    expect(result).toEqual({ sent: 501, upserted: 499, skipped: 2 });
  });
});
