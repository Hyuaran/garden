import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const insert = vi.fn(async () => ({ error: null }));
const select = vi.fn(() => ({
  eq: vi.fn(() => ({ eq: vi.fn(() => ({ gte: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [] })) })) })) })),
}));

vi.mock("@/lib/innovera/calls.server", () => ({
  requireCallAccess: vi.fn(async () => ({
    supabase: { from: vi.fn(() => ({ select, insert })) },
    employeeId: "EMP-1",
    role: "own",
    access: "own",
    ownExtension: "2040",
    ownExtensions: ["2040", "1003"],
  })),
  callAccessErrorResponse: vi.fn((error) => { throw error; }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: vi.fn(() => ({ select, insert })) }),
}));

vi.mock("@/lib/innovera/client", () => ({
  searchInnoveraCalls: vi.fn(async () => [
    { id: "cdr-1", uniqid: "u1", caller_num: "2040", callee_num: "090", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
    { id: "cdr-2", uniqid: "u2", caller_num: "2050", callee_num: "080", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
    { id: "cdr-3", uniqid: "u3", caller_num: "2040", callee_num: "070", call_type: "2", dial_status: "1", talk_time: null, start_time: "2099-10-08 11:59:30", end_time: "", record_file_flg: "1" },
    { id: "cdr-4", uniqid: "u4", caller_num: "1003", callee_num: "060", call_type: "2", dial_status: "1", talk_time: "00:00:10", start_time: "2026-10-08 10:00:00", end_time: "2026-10-08 10:00:10", record_file_flg: "1" },
  ]),
  getInnoveraRecordingUrl: vi.fn(async () => ({ filepath: "https://recording.example.test/a.wav" })),
}));

describe("innovera recording route", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("wav", {
      status: 206,
      headers: { "content-type": "audio/x-wav", "content-range": "bytes 0-2/3", "content-length": "3" },
    })));
    insert.mockClear();
  });

  it("rejects another employee recording", async () => {
    const response = await GET(
      new Request("http://localhost/api/system/innovera-calls/recording/cdr-2?uniqid=u2&date=2026-10-08"),
      { params: Promise.resolve({ cdrId: "cdr-2" }) },
    );
    expect(response.status).toBe(403);
  });

  it("rejects in-progress calls", async () => {
    const response = await GET(
      new Request("http://localhost/api/system/innovera-calls/recording/cdr-3?uniqid=u3&date=2026-10-08"),
      { params: Promise.resolve({ cdrId: "cdr-3" }) },
    );
    expect(response.status).toBe(409);
  });

  it("streams recording with range headers and writes a play log", async () => {
    const response = await GET(
      new Request("http://localhost/api/system/innovera-calls/recording/cdr-1?uniqid=u1&date=2026-10-08", {
        headers: { range: "bytes=0-2" },
      }),
      { params: Promise.resolve({ cdrId: "cdr-1" }) },
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-type")).toBe("audio/x-wav");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toBeInstanceOf(Headers);
  });

  it("allows own mobile extension recording", async () => {
    const response = await GET(
      new Request("http://localhost/api/system/innovera-calls/recording/cdr-4?uniqid=u4&date=2026-10-08"),
      { params: Promise.resolve({ cdrId: "cdr-4" }) },
    );
    expect(response.status).toBe(206);
  });
});
