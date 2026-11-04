import { describe, expect, it } from "vitest";
import {
  classifyPunchDay,
  currentPunchAgent,
  kotTimestamp,
  punchDeadline,
} from "./kot-punch";
import { attendanceDevice } from "./device";
import { transformDayPunches } from "@/app/api/system/attendance/kot-export/_lib/kot-transform";
import { validateDays, monthDays } from "@/lib/shift/rules";
const date = "2026-11-03";
const punch = (
  punch_type: "clock_in" | "clock_out" | "break_start" | "break_end",
  time: string,
) => ({ punch_type, punched_at: `${date}T${time}+09:00` });
const complete = [
  punch("clock_in", "10:00:01"),
  punch("clock_out", "21:00:01"),
];
describe("打刻の送信条件と休憩", () => {
  it("classifies complete, missing, pending and expired days", () => {
    const input = {
      date,
      punches: complete,
      isOffice: false,
      pending: false,
      now: Date.parse(date + "T22:00:00+09:00"),
    };
    expect(classifyPunchDay(input).status).toBe("ready");
    expect(
      classifyPunchDay({ ...input, punches: complete.slice(0, 1) }).status,
    ).toBe("needs_check");
    expect(classifyPunchDay({ ...input, pending: true }).status).toBe(
      "pending",
    );
    expect(
      classifyPunchDay({ ...input, now: punchDeadline(date) }).status,
    ).toBe("expired");
    expect(
      classifyPunchDay({ ...input, now: punchDeadline(date) - 1 }).status,
    ).toBe("ready");
  });
  it("retains an explicit break to the minute and suppresses automatic lunch", () => {
    const result = transformDayPunches({
      date,
      isOffice: false,
      punches: [
        ...complete,
        punch("break_start", "15:07:59"),
        punch("break_end", "15:44:21"),
      ],
    });
    expect(result.issues).toEqual([]);
    expect(result.punches.map((row) => kotTimestamp(row.punched_at))).toEqual([
      `${date}T10:00:00+09:00`,
      `${date}T15:07:00+09:00`,
      `${date}T15:44:00+09:00`,
      `${date}T21:00:00+09:00`,
    ]);
  });
  it("returns to automatic lunch after explicit punches are removed", () => {
    const result = transformDayPunches({
      date,
      isOffice: false,
      punches: complete,
    });
    expect(
      result.punches
        .filter((row) => row.punch_type.startsWith("break"))
        .map((row) => kotTimestamp(row.punched_at)),
    ).toEqual([`${date}T13:00:00+09:00`, `${date}T14:00:00+09:00`]);
  });
  it.each([
    [punch("break_start", "15:00:00")],
    [punch("break_end", "15:00:00"), punch("break_start", "16:00:00")],
    [punch("break_start", "09:00:00"), punch("break_end", "11:00:00")],
    [punch("break_start", "20:50:00"), punch("break_end", "21:10:00")],
  ])("rejects incomplete, reversed or outside breaks", (...breaks) => {
    expect(
      transformDayPunches({
        date,
        isOffice: false,
        punches: [...complete, ...breaks],
      }).issues.length,
    ).toBeGreaterThan(0);
    expect(
      transformDayPunches({
        date,
        isOffice: true,
        punches: [...complete, ...breaks],
      }).issues,
    ).toEqual([]);
  });
  it.each(["1.4.0", "1.4.1", "2.0.0"])("accepts punch agent %s", (version) =>
    expect(currentPunchAgent(version)).toBe(true),
  );
  it.each([null, "1.3.1", "1.4", "invalid"])(
    "rejects old or invalid punch agent %s",
    (version) => expect(currentPunchAgent(version)).toBe(false),
  );
  it.each(["iPhone", "Android", "iPad", "Mobi"])(
    "records %s as smartphone",
    (agent) => {
      expect(attendanceDevice(new Headers({ "User-Agent": agent }))).toBe(
        "smartphone",
      );
    },
  );
  it("uses client hints and records desktop without restricting either", () => {
    expect(attendanceDevice(new Headers({ "Sec-CH-UA-Mobile": "?1" }))).toBe(
      "smartphone",
    );
    expect(attendanceDevice(new Headers({ "User-Agent": "Windows NT" }))).toBe(
      "pc",
    );
  });
  it("keeps self submission limited while allowing manager to save 18:30 and 20:30", () => {
    for (const start_time of ["18:30", "19:00", "20:30"]) {
      const rows = monthDays("2026-11").map((work_date) => ({
        work_date,
        start_time,
      }));
      expect(() => validateDays("2026-11", rows)).toThrow();
      expect(validateDays("2026-11", rows, true)).toEqual(rows);
    }
  });
});
