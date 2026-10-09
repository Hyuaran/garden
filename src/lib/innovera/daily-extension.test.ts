import { describe, expect, it } from "vitest";
import {
  callInOwnWindow,
  needsDailyExtension,
  tokyoDayEndIso,
  validateDailyExtension,
} from "./daily-extension";

describe("daily innovera extension", () => {
  it("requires daily extension only for limited roles without fixed extensions", () => {
    expect(needsDailyExtension({ id: "1", name: "A", gardenRole: "toss" })).toBe(true);
    expect(needsDailyExtension({ id: "1", name: "A", gardenRole: "closer", innoveraExtension: "2007" })).toBe(false);
    expect(needsDailyExtension({ id: "1", name: "A", gardenRole: "outsource", innoveraMobileExtension: "2014" })).toBe(false);
    expect(needsDailyExtension({ id: "1", name: "A", gardenRole: "cs" })).toBe(false);
  });

  it("validates extension input", () => {
    expect(validateDailyExtension("").error).toBe("今日の内線番号を入力してください");
    expect(validateDailyExtension("20a7").error).toBe("内線番号は数字で入力してください");
    expect(validateDailyExtension("2007")).toEqual({ ok: true, extension: "2007" });
  });

  it("matches call start time inside the daily window", () => {
    const windows = [{
      extension: "2007",
      from: "2026-10-09T05:00:00.000Z",
      to: "2026-10-09T09:30:00.000Z",
      endedAt: "2026-10-09T09:30:00.000Z",
      endedReason: "clock_out",
    }];
    expect(callInOwnWindow({ extension: "2007", startTime: "2026-10-09 14:02:00" }, windows)).toBe(true);
    expect(callInOwnWindow({ extension: "2007", startTime: "2026-10-09 18:31:00" }, windows)).toBe(false);
    expect(callInOwnWindow({ extension: "2014", startTime: "2026-10-09 14:02:00" }, windows)).toBe(false);
    expect(tokyoDayEndIso("2026-10-09")).toBe("2026-10-09T15:00:00.000Z");
  });
});
