import { expect, it, vi } from "vitest";
import { buildKotRequest, handleJob } from "../agent.mjs";

const env = { KOT_API_TOKEN: "mock" };
const body = {
  employeeScheduleRequests: [
    {
      employeeKey: "abc123",
      dailySchedules: [
        {
          workingDate: "2026-12-02",
          workPlaceDivisionCode: "1000",
          clockInSchedule: "2026-12-02T14:00+09:00",
          clockOutSchedule: "2026-12-02T21:00+09:00",
        },
      ],
    },
  ],
};

it("allows exact schedule operations and rejects unsafe paths, query and bodies", () => {
  expect(
    buildKotRequest({ method: "PUT", path: "/daily-schedules", body }, env).init
      .body,
  ).toBe(JSON.stringify(body));
  expect(
    buildKotRequest(
      {
        method: "GET",
        path: "/daily-schedules?division=1000&ondivision=true&start=2026-12-01&end=2026-12-31",
      },
      env,
    ).init.method,
  ).toBe("GET");
  expect(
    buildKotRequest(
      { method: "DELETE", path: "/daily-schedules/abc123/2026-12-02" },
      env,
    ).init.method,
  ).toBe("DELETE");
  for (const path of [
    "/daily-schedules/",
    "/daily-schedules?x=1",
    "/daily-schedules?start=2026-02-30",
    "/daily-schedules?division=1&division=2",
    "/daily-schedules?ondivision=1",
  ]) {
    expect(() => buildKotRequest({ method: "GET", path }, env)).toThrow();
  }
  for (const path of [
    "/daily-schedules/a-b/2026-12-01",
    "/daily-schedules/abc/2026-02-30",
    "/daily-schedules/abc/2026-12-01?x=1",
  ]) {
    expect(() => buildKotRequest({ method: "DELETE", path }, env)).toThrow();
  }
  for (const invalid of [
    {},
    [],
    { ...body, extra: true },
    { employeeScheduleRequests: [] },
    { employeeScheduleRequests: [{ employeeKey: "x", dailySchedules: [{}] }] },
    {
      employeeScheduleRequests: Array(800).fill(
        body.employeeScheduleRequests[0],
      ),
    },
  ]) {
    expect(() =>
      buildKotRequest(
        { method: "PUT", path: "/daily-schedules", body: invalid },
        env,
      ),
    ).toThrow();
  }
});

it("DELETE 204 returns null without parsing JSON", async () => {
  const fetch = vi.fn(async () => new Response(null, { status: 204 }));
  expect(
    await handleJob(
      {
        id: "1",
        kind: "kot",
        request: { method: "DELETE", path: "/daily-schedules/abc/2026-12-02" },
      },
      { fetch, env, sleep: async () => {} },
    ),
  ).toEqual({ id: "1", ok: true, result: null });
});

it.each([429, 403])(
  "retries schedule throttling %s serially",
  async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ errors: [{ code: 105 }] }, { status }),
      )
      .mockResolvedValueOnce(Response.json({ successRequest: [] }));
    const sleep = vi.fn(async () => {});
    const result = await handleJob(
      {
        id: "1",
        kind: "kot",
        request: { method: "PUT", path: "/daily-schedules", body },
      },
      { fetch, env, sleep },
    );
    expect(result.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(1000);
  },
);

it("allows a lunch break and a full-day holiday, and rejects other shapes", () => {
  const send = (day) =>
    buildKotRequest(
      {
        method: "PUT",
        path: "/daily-schedules",
        body: {
          employeeScheduleRequests: [
            {
              employeeKey: "abc123",
              dailySchedules: [
                {
                  workingDate: "2026-12-05",
                  workPlaceDivisionCode: "104",
                  ...day,
                },
              ],
            },
          ],
        },
      },
      env,
    );
  const work = {
    clockInSchedule: "2026-12-05T10:00+09:00",
    clockOutSchedule: "2026-12-05T21:00+09:00",
  };
  const lunch = {
    start: "2026-12-05T13:00+09:00",
    end: "2026-12-05T14:00+09:00",
  };
  expect(() => send({ ...work, startEndBreakSchedule: [lunch] })).not.toThrow();
  expect(() => send({ fulltimeHoliday: { code: "9" } })).not.toThrow();
  expect(() => send({ ...work, note: "x" })).toThrow();
  expect(() => send({ ...work, startEndBreakSchedule: [] })).toThrow();
  expect(() =>
    send({ ...work, fulltimeHoliday: { code: "9" } }),
  ).toThrow();
  expect(() => send({ fulltimeHoliday: { code: "x" } })).toThrow();
  expect(() =>
    send({
      ...work,
      startEndBreakSchedule: [{ ...lunch, start: "2026-12-06T13:00+09:00" }],
    }),
  ).toThrow();
});
