import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { searchInnoveraCalls } from "@/lib/innovera/client";

vi.mock("@/lib/innovera/calls.server", () => ({
  requireCallAccess: vi.fn(async () => ({
    supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [] })) })) })) },
    employeeId: "EMP-1",
    employeeName: "Agent",
    role: "cs",
    access: "own",
    ownExtension: "2040",
    ownExtensions: ["2040", "1003"],
  })),
  callAccessErrorResponse: vi.fn((error) => { throw error; }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: vi.fn(() => ({ select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [{ name: "Agent", innovera_extension: "2040", innovera_mobile_extension: "1003" }] })) })) })) }),
}));

vi.mock("@/lib/innovera/client", () => ({
  searchInnoveraCalls: vi.fn(async () => [
    { id: "cdr-1", uniqid: "u1", caller_num: "2040", callee_num: "090", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
    { id: "cdr-2", uniqid: "u2", caller_num: "1003", callee_num: "080", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
    { id: "cdr-3", uniqid: "u3", caller_num: "2050", callee_num: "070", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
  ]),
}));

describe("innovera calls route", () => {
  it("returns PC and mobile calls to own access users", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?date=2026-10-08"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.calls.map((call: { extension: string }) => call.extension)).toEqual(["2040", "1003"]);
    expect(body.ownExtensions).toEqual(["2040", "1003"]);
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("filters mine across PC and mobile extensions", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?date=2026-10-08&mine=1"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.calls.map((call: { extension: string }) => call.extension)).toEqual(["2040", "1003"]);
  });

  it("rejects dates older than one year", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?date=2000-01-01"));
    expect(response.status).toBe(400);
  });

  it("searches by from/to range and returns it", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?from=2026-10-08T09:30&to=2026-10-09T18:15"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.range).toEqual({ from: "2026-10-08T09:30", to: "2026-10-09T18:15", wide: false });
    expect(vi.mocked(searchInnoveraCalls).mock.calls.at(-1)?.[0]).toMatchObject({
      from: "2026-10-08 09:30:00",
      to: "2026-10-09 18:15:59",
    });
  });

  it("defaults a missing range end to the same day", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?from=2026-10-07T09:30"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.range).toEqual({ from: "2026-10-07T09:30", to: "2026-10-07T23:59", wide: false });
  });

  it("searches a whole year by number when the period is blank", async () => {
    const response = await GET(new Request("http://localhost/api/system/innovera-calls?number=090-1131"));
    expect(response.status).toBe(200);
    const body = await response.json();
    // 期間が空欄＋番号あり＝1 年ぶん（wide）。INNOVERA には数字だけの番号を渡す
    expect(body.range.wide).toBe(true);
    expect(body.range.from.slice(0, 4)).toBe(String(Number(body.range.to.slice(0, 4)) - 1));
    expect(vi.mocked(searchInnoveraCalls).mock.calls.at(-1)?.[0]).toMatchObject({ number: "0901131" });
  });

  it("rejects invalid ranges", async () => {
    const reversed = await GET(new Request("http://localhost/api/system/innovera-calls?from=2026-10-09T00:00&to=2026-10-08T23:59"));
    expect(reversed.status).toBe(400);
    const tooLong = await GET(new Request("http://localhost/api/system/innovera-calls?from=2026-10-01T00:00&to=2026-11-02T00:00"));
    expect(tooLong.status).toBe(400);
  });
});
