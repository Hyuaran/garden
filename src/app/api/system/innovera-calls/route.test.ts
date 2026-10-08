import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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
});
