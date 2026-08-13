import { describe, expect, it } from "vitest";
import { isJapaneseHoliday, shouldDeliverAt } from "./call-report-schedule";

const jst = (value: string) => new Date(`${value}+09:00`);

describe("shouldDeliverAt", () => {
  it("uses the 15:00-21:59 window on weekdays", () => {
    expect(shouldDeliverAt(jst("2026-08-12T14:05:00"))).toMatchObject({ deliver: false, reason: "out_of_window", todayType: "weekday" });
    expect(shouldDeliverAt(jst("2026-08-12T15:05:00"))).toMatchObject({ deliver: true, todayType: "weekday" });
    expect(shouldDeliverAt(jst("2026-08-12T21:05:00"))).toMatchObject({ deliver: true, todayType: "weekday" });
  });

  it("uses the 11:00-21:59 window on weekends", () => {
    expect(shouldDeliverAt(jst("2026-08-15T10:05:00"))).toMatchObject({ deliver: false, todayType: "weekend" });
    expect(shouldDeliverAt(jst("2026-08-15T11:05:00"))).toMatchObject({ deliver: true, todayType: "weekend" });
  });

  it("treats weekday holidays and statutory holidays as weekends", () => {
    expect(shouldDeliverAt(jst("2026-02-11T11:05:00"))).toMatchObject({ deliver: true, todayType: "holiday" });
    expect(shouldDeliverAt(jst("2026-09-22T15:05:00"))).toMatchObject({ deliver: true, todayType: "holiday" });
    expect(isJapaneseHoliday("2027-03-22")).toBe(true);
    expect(isJapaneseHoliday("2026-08-12")).toBe(false);
  });
});
