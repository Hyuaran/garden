import { describe, expect, it } from "vitest";

import { EXPORT_ALLOWED_CIRCUITS, exportInnoveraCalls, parseExportParams } from "./export.server";

type Call = { method: string; args: unknown[] };

/** supabase の from().select()… の呼び方を（表をまたいで）呼んだ順に記録し、決めた返事を順に返す偽物 */
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

const argsOf = (calls: Call[], method: string) => calls.filter((c) => c.method === method).map((c) => c.args);

const RANGE = { from: "2026-10-19 00:00:00", to: "2026-10-19 23:59:59" };
const LOG = { range_to: "2026-10-22T05:55:00.000Z", finished_at: "2026-10-22T05:55:03.000Z" };

describe("parseExportParams", () => {
  it("accepts allowed circuit ids and a JST range in the INNOVERA format", () => {
    expect(parseExportParams({ circuits: [164, "165"], from: "2026-10-19 00:00:00", to: "2026-10-22 23:59:59" })).toEqual({
      circuits: [164, 165],
      from: "2026-10-19 00:00:00",
      to: "2026-10-22 23:59:59",
    });
  });

  it("allows exactly the circuits of WEB inbound in kintone 239 (133・164・165・166・185・186)", () => {
    expect([...EXPORT_ALLOWED_CIRCUITS].sort((a, b) => a - b)).toEqual([133, 164, 165, 166, 185, 186]);
    expect(parseExportParams({ circuits: [164, 165, 166, 133, 186, 185], ...RANGE }).circuits).toEqual([164, 165, 166, 133, 186, 185]);
    // 隣の番号は許可しない
    expect(() => parseExportParams({ circuits: [184], ...RANGE })).toThrow(/not allowed: 184/);
    expect(() => parseExportParams({ circuits: [187], ...RANGE })).toThrow(/not allowed: 187/);
  });

  it("rejects circuits that are not allowed, even mixed with allowed ones", () => {
    expect(() => parseExportParams({ circuits: [200], ...RANGE })).toThrow(/not allowed/);
    expect(() => parseExportParams({ circuits: [164, 1], ...RANGE })).toThrow(/not allowed/);
  });

  it("rejects missing circuits and circuits that are neither integers nor digit strings", () => {
    expect(() => parseExportParams({ circuits: [], ...RANGE })).toThrow();
    expect(() => parseExportParams({ ...RANGE })).toThrow();
    for (const bad of [true, null, {}, [164], 164.5, "164.0", " 164", "164 ", "1e2", "0xa4", "", -164, 0, "-164"]) {
      expect(() => parseExportParams({ circuits: [bad], ...RANGE }), `circuit ${JSON.stringify(bad)}`).toThrow(/circuits must/);
    }
  });

  it("drops duplicated circuits", () => {
    expect(parseExportParams({ circuits: [164, "164", 165], ...RANGE }).circuits).toEqual([164, 165]);
  });

  it("rejects unreadable, reversed or too long ranges", () => {
    expect(() => parseExportParams({ circuits: [164], from: "2026/10/19", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [164], from: 20261019, to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [164], from: "2026-10-20 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
    expect(() => parseExportParams({ circuits: [164], from: "2026-09-01 00:00:00", to: "2026-10-19 23:59:59" })).toThrow();
  });

  it("rejects dates and times that do not exist instead of rolling them over", () => {
    for (const bad of [
      "2026-02-30 00:00:00",
      "2026-02-29 00:00:00",
      "2026-04-31 00:00:00",
      "2026-13-01 00:00:00",
      "2026-00-10 00:00:00",
      "2026-10-00 00:00:00",
      "2026-10-19 24:00:00",
      "2026-10-19 25:61:61",
      "2026-10-19 23:60:00",
      "2026-10-19 23:59:60",
    ]) {
      expect(() => parseExportParams({ circuits: [164], from: bad, to: bad }), bad).toThrow(/YYYY-MM-DD HH:MM:SS/);
    }
    // from は正しく to だけが無い日時（繰り上げると期間の中に収まる）でも断る
    expect(() => parseExportParams({ circuits: [164], from: "2026-10-19 00:00:00", to: "2026-10-20 24:00:00" })).toThrow(/YYYY-MM-DD HH:MM:SS/);
    expect(() => parseExportParams({ circuits: [164], from: "2026-02-27 00:00:00", to: "2026-02-30 00:00:00" })).toThrow(/YYYY-MM-DD HH:MM:SS/);
    // うるう年の 2/29 は実在する
    expect(parseExportParams({ circuits: [164], from: "2028-02-29 00:00:00", to: "2028-02-29 23:59:59" }).from).toBe("2028-02-29 00:00:00");
  });
});

describe("exportInnoveraCalls", () => {
  it("returns the raw INNOVERA rows of the circuits in the range, page by page, with the ingest coverage", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ raw: { id: String(i), circuit_id: "164" } }));
    const page2 = [{ raw: { id: "1000", circuit_id: "165" } }, { raw: null }];
    const { client, calls } = fakeSupabase([page1, page2], LOG);

    const result = await exportInnoveraCalls({ circuits: [164, 165], from: "2026-10-19 00:00:00", to: "2026-10-22 23:59:59" }, client);

    expect(result.rows).toHaveLength(1001);
    expect(result.rows[1000]).toEqual({ id: "1000", circuit_id: "165" });
    expect(result.covered_until).toBe("2026-10-22T05:55:00.000Z");
    expect(result.last_success_at).toBe("2026-10-22T05:55:03.000Z");
    expect(calls).toContainEqual({ method: "system_innovera_call.in", args: ["circuit_id", [164, 165]] });
    // JST の 00:00:00 は UTC の前日 15:00:00
    expect(calls).toContainEqual({ method: "system_innovera_call.gte", args: ["start_time", "2026-10-18T15:00:00.000Z"] });
    expect(calls).toContainEqual({ method: "system_innovera_call.lte", args: ["start_time", "2026-10-22T14:59:59.000Z"] });
    expect(argsOf(calls, "system_innovera_call.range")).toEqual([[0, 999], [1000, 1999]]);
  });

  it("orders every page by start time, then by the INNOVERA id (unique), so pages neither overlap nor skip", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ raw: { id: String(i) } }));
    const { client, calls } = fakeSupabase([page1, []], null);
    await exportInnoveraCalls({ circuits: [164], ...RANGE }, client);

    const pageOrder = [["start_time", { ascending: true }], ["innovera_id", { ascending: true }]];
    expect(argsOf(calls, "system_innovera_call.order")).toEqual([...pageOrder, ...pageOrder]);
  });

  it("picks the latest successful poll/daily ingest (not backfill, not failed)", async () => {
    const { client, calls } = fakeSupabase([[]], LOG);
    await exportInnoveraCalls({ circuits: [164], ...RANGE }, client);

    expect(argsOf(calls, "system_innovera_ingest_log.select")).toEqual([["range_to, finished_at"]]);
    expect(argsOf(calls, "system_innovera_ingest_log.eq")).toEqual([["status", "success"]]);
    expect(argsOf(calls, "system_innovera_ingest_log.in")).toEqual([["mode", ["poll", "daily"]]]);
    expect(argsOf(calls, "system_innovera_ingest_log.order")).toEqual([["finished_at", { ascending: false }]]);
    expect(argsOf(calls, "system_innovera_ingest_log.limit")).toEqual([[1]]);
  });

  it("reads the ingest log before the rows, so covered_until never claims calls written after the rows were read", async () => {
    const { client, calls } = fakeSupabase([[]], LOG);
    await exportInnoveraCalls({ circuits: [164], ...RANGE }, client);

    const logRead = calls.findIndex((c) => c.method === "system_innovera_ingest_log.maybeSingle");
    const firstRowRead = calls.findIndex((c) => c.method.startsWith("system_innovera_call."));
    expect(logRead).toBeGreaterThanOrEqual(0);
    expect(firstRowRead).toBeGreaterThan(logRead);
  });

  it("does not touch the rows until the ingest log has been answered (not only asked)", async () => {
    const { client, calls } = fakeSupabase([[]], null);
    let answerLog: (value: { data: typeof LOG; error: null }) => void = () => {};
    const pendingLog = new Promise<{ data: typeof LOG; error: null }>((resolve) => { answerLog = resolve; });
    const from = (client as unknown as { from: (table: string) => Record<string, unknown> }).from;
    const slowClient = {
      from: (table: string) => {
        const chain = from(table);
        if (table === "system_innovera_ingest_log") chain.maybeSingle = () => pendingLog;
        return chain;
      },
    } as never;

    const running = exportInnoveraCalls({ circuits: [164], ...RANGE }, slowClient);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls.some((c) => c.method.startsWith("system_innovera_call."))).toBe(false);

    answerLog({ data: LOG, error: null });
    await expect(running).resolves.toMatchObject({ covered_until: LOG.range_to });
    expect(calls.some((c) => c.method.startsWith("system_innovera_call."))).toBe(true);
  });

  it("refuses circuits that are not allowed even when called directly", async () => {
    const { client, calls } = fakeSupabase([[]], LOG);
    await expect(exportInnoveraCalls({ circuits: [164, 999], ...RANGE }, client)).rejects.toThrow(/not allowed/);
    expect(calls).toEqual([]);
  });

  it("returns null coverage when no ingest has succeeded", async () => {
    const { client } = fakeSupabase([[]], null);
    const result = await exportInnoveraCalls({ circuits: [164], ...RANGE }, client);
    expect(result).toEqual({ rows: [], covered_until: null, last_success_at: null });
  });
});
