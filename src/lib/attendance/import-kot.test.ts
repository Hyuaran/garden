import { expect, it } from "vitest";
// Standalone script exports pure helpers for offline tests.
import {
  importPunches,
  importShift,
  punchId,
  assertReadTime,
} from "../../../scripts/attendance/import-kot-november.mjs";
it("converts four types, reports unsupported records, and creates stable UUID v5", () => {
  const time = "2026-11-03T14:00:00+09:00";
  const first = importPunches(
    "0001",
    [1, 2, 3, 4, 5].map((code) => ({ code: String(code), time })),
  );
  expect(
    first.punches.map((row: { punch_type: string }) => row.punch_type),
  ).toEqual(["clock_in", "clock_out", "break_start", "break_end"]);
  expect(first.skipped).toHaveLength(1);
  expect(first).toEqual(
    importPunches(
      "0001",
      [1, 2, 3, 4, 5].map((code) => ({ code: String(code), time })),
    ),
  );
  expect(punchId("0001", time, "clock_in")).toMatch(
    /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  );
});
it("imports 18:30 without resetting sent status and refuses other ending times", () => {
  expect(
    importShift({
      clockInSchedule: "2026-11-03T18:30+09:00",
      clockOutSchedule: "2026-11-03T21:00+09:00",
    }).shift,
  ).toEqual({ start_time: "18:30", kot_status: "sent" });
  expect(
    importShift({
      clockInSchedule: "2026-11-03T09:30+09:00",
      clockOutSchedule: "2026-11-03T18:00+09:00",
    }).reason,
  ).toBeTruthy();
  expect(
    importShift({ holidaysObtained: { fulltimeHoliday: { name: "公休" } } })
      .shift!.kot_status,
  ).toBe("skipped");
  expect(importShift(null).shift!.start_time).toBeNull();
});
it("blocks both prohibited read windows", () => {
  for (const time of ["08:30", "09:59", "17:30", "18:29"])
    expect(() =>
      assertReadTime(new Date(`2026-11-03T${time}:00+09:00`)),
    ).toThrow();
  for (const time of ["10:00", "18:30"])
    expect(() =>
      assertReadTime(new Date(`2026-11-03T${time}:00+09:00`)),
    ).not.toThrow();
});
