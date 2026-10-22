import { describe, expect, it } from "vitest";

import { exportInnoveraCalls, parseExportParams } from "./export.server";

type Call = { method: string; args: unknown[] };

/** supabase の from().select()… の呼び方を記録し、決めた返事を順に返す偽物 */
function fakeSupabase(pages: unknown[][], log: { range_to: string; finished_at: string } | null) {
  const calls: Call[] = [];
  let page = 0;
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const record = (method: string) => (...args: unknown[]) => {
      calls.push({ method: `${table}.${method}`, args });
      return chain;
    };
    for (const m of ["select", "in", "gte", "lte", "eq", "order", "limit"]) chain[m] = record(m);
    chain.range = (...args: unknown[]) => {
      calls.push({ method: `${table}.range`, args });
      const data = pages[page] ?? [];
      page += 1;
      return Promise.resolve({ data, error: null });
    };
    chain.maybeSingle = () => {
      calls.push({ method: `${table}.maybeSingle`, args: [] });
      return Promise.resolve({ data: log, error: null });
    };
    return chain;
  };
  return { client: { from: (table: string) => builder(table) } as never, calls };
}

describe("parseExportParams", () => {
  it("accepts circuit ids and a JST range in the INNOVERA format", () => {
    expect(parseExportParams({ circuits: [164, "165"], from: "2026-10-19 00:00:00", to: "2026-10-22 23:59:59" })).toEqual({
      circuits: [164, 165],
      from: "2026-10-19 00:00:00",
      to: "2026-10-22 23:59:59",
    });
  });

  it("rejects missing or invalid circuits", () => {
    expect(() => parseExportParams({ circuits: [], from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [0], from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: ["abc"], from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: Array.from({ length: 21 }, (_, i) => i + 1), from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
  });

  it("rejects unreadable, reversed or too long ranges", () => {
    expect(() => parseExportParams({ circuits: [164], from: "2026/10/19", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [164], from: "2026-10-20 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [164], from: "2026-09-01 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
  });
});

describe("exportInnoveraCalls", () => {
  it("returns the raw INNOVERA rows of the circuits in the range, page by page, with the ingest coverage", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ raw: { id: String(i), circuit_id: "164" } }));
    const page2 = [{ raw: { id: "1000", circuit_id: "165" } }, { raw: null }];
    const { client, calls } = fakeSupabase([page1, page2], { range_to: "2026-10-22T05:55:00.000Z", finished_at: "2026-10-22T05:55:03.000Z" });

    const result = await exportInnoveraCalls({ circuits: [164, 165], from: "2026-10-19 00:00:00", to: "2026-10-22 23:59:59" }, client);

    expect(result.rows).toHaveLength(1001);
    expect(result.rows[1000]).toEqual({ id: "1000", circuit_id: "165" });
    expect(result.covered_until).toBe("2026-10-22T05:55:00.000Z");
    expect(result.last_success_at).toBe("2026-10-22T05:55:03.000Z");
    expect(calls).toContainEqual({ method: "system_innovera_call.in", args: ["circuit_id", [164, 165]] });
    // JST の 00:00:00 は UTC の前日 15:00:00
    expect(calls).toContainEqual({ method: "system_innovera_call.gte", args: ["start_time", "2026-10-18T15:00:00.000Z"] });
    expect(calls).toContainEqual({ method: "system_innovera_call.lte", args: ["start_time", "2026-10-22T14:59:59.000Z"] });
    expect(calls.filter((c) => c.method === "system_innovera_call.range").map((c) => c.args)).toEqual([[0, 999], [1000, 1999]]);
    expect(calls).toContainEqual({ method: "system_innovera_ingest_log.eq", args: ["status", "success"] });
    expect(calls).toContainEqual({ method: "system_innovera_ingest_log.in", args: ["mode", ["poll", "daily"]] });
  });

  it("returns null coverage when no ingest has succeeded", async () => {
    const { client } = fakeSupabase([[]], null);
    const result = await exportInnoveraCalls({ circuits: [164], from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" }, client);
    expect(result).toEqual({ rows: [], covered_until: null, last_success_at: null });
  });
});
