import { describe, expect, it, vi } from "vitest";
import { buildKotRequest, handleJob } from "../agent.mjs";
const env = { KOT_API_TOKEN: "test-only" };
const row = {
  date: "2026-11-03",
  time: "2026-11-03T14:00:00+09:00",
  code: "1",
  recordId: "garden-test",
};
const request = {
  method: "POST",
  path: "/daily-workings/timerecord",
  body: {
    employeeTimeRecordRequests: [{ employeeKey: "abc123", timeRecords: [row] }],
  },
};
describe("打刻の中継", () => {
  it("permits the bounded body and exact query", () => {
    expect(buildKotRequest(request, env).init.method).toBe("POST");
    expect(
      buildKotRequest(
        {
          method: "GET",
          path: "/daily-workings/timerecord?employeeKeys=abc123&start=2026-11-03&end=2026-11-03",
        },
        env,
      ).init.method,
    ).toBe("GET");
  });
  it.each([
    {
      ...request,
      body: {
        employeeTimeRecordRequests: [
          { employeeKey: "a-b", timeRecords: [row] },
        ],
      },
    },
    {
      ...request,
      body: {
        employeeTimeRecordRequests: [
          { employeeKey: "abc123", timeRecords: Array(1001).fill(row) },
        ],
      },
    },
    {
      ...request,
      body: {
        employeeTimeRecordRequests: [
          { employeeKey: "abc123", timeRecords: [{ ...row, extra: true }] },
        ],
      },
    },
    {
      ...request,
      body: {
        employeeTimeRecordRequests: [
          { employeeKey: "abc123", timeRecords: [{ ...row, code: "5" }] },
        ],
      },
    },
    {
      ...request,
      body: {
        employeeTimeRecordRequests: [
          {
            employeeKey: "abc123",
            timeRecords: Array(900).fill({ ...row, recordId: "x".repeat(100) }),
          },
        ],
      },
    },
    { method: "GET", path: "/daily-workings/timerecord?division=104" },
    {
      method: "GET",
      path: "/daily-workings/timerecord?start=2026-11-03&start=2026-11-03",
    },
  ])("rejects unsafe body or query", (input) =>
    expect(() => buildKotRequest(input, env)).toThrow(),
  );
  it.each([500, 403])("never retries a POST with HTTP %s", async (status) => {
    const fetch = vi.fn(async () => new Response("{}", { status }));
    expect(
      await handleJob(
        { id: "test", kind: "kot", request },
        { fetch, env, sleep: async () => {} },
      ),
    ).toMatchObject({ ok: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
