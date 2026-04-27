import { describe, it, expect } from "vitest";
import {
  isWeekend,
  isBusinessDay,
  nextBusinessDay,
  parseIsoDate,
  isAtLeastNextBusinessDay,
} from "../business-day";

describe("isWeekend / isBusinessDay", () => {
  it("2026-04-25 は土曜日 → 週末", () => {
    const sat = new Date(2026, 3, 25);
    expect(sat.getDay()).toBe(6);
    expect(isWeekend(sat)).toBe(true);
    expect(isBusinessDay(sat)).toBe(false);
  });

  it("2026-04-26 は日曜日 → 週末", () => {
    const sun = new Date(2026, 3, 26);
    expect(sun.getDay()).toBe(0);
    expect(isWeekend(sun)).toBe(true);
  });

  it("2026-04-27 は月曜日 → 営業日", () => {
    const mon = new Date(2026, 3, 27);
    expect(mon.getDay()).toBe(1);
    expect(isBusinessDay(mon)).toBe(true);
  });
});

describe("nextBusinessDay", () => {
  it("月曜の翌営業日は火曜", () => {
    const mon = new Date(2026, 3, 27); // Mon
    const next = nextBusinessDay(mon);
    expect(next.getDate()).toBe(28);
    expect(next.getDay()).toBe(2);
  });

  it("金曜の翌営業日は月曜（週末スキップ）", () => {
    const fri = new Date(2026, 3, 24); // Fri
    const next = nextBusinessDay(fri);
    expect(next.getDate()).toBe(27); // Mon
    expect(next.getDay()).toBe(1);
  });

  it("土曜の翌営業日は月曜", () => {
    const sat = new Date(2026, 3, 25); // Sat
    const next = nextBusinessDay(sat);
    expect(next.getDay()).toBe(1);
  });

  it("日曜の翌営業日は月曜", () => {
    const sun = new Date(2026, 3, 26); // Sun
    const next = nextBusinessDay(sun);
    expect(next.getDay()).toBe(1);
  });
});

describe("parseIsoDate", () => {
  it("正常な ISO 日付", () => {
    const d = parseIsoDate("2026-04-27");
    expect(d).not.toBeNull();
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(3);
    expect(d?.getDate()).toBe(27);
  });

  it("不正フォーマットは null", () => {
    expect(parseIsoDate("2026/04/27")).toBeNull();
    expect(parseIsoDate("26-4-27")).toBeNull();
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("not-a-date")).toBeNull();
  });

  it("存在しない日付は null（2026-02-30 等）", () => {
    expect(parseIsoDate("2026-02-30")).toBeNull();
    expect(parseIsoDate("2026-13-01")).toBeNull();
  });
});

describe("isAtLeastNextBusinessDay — V8 翌営業日以降チェック", () => {
  it("月曜から見て火曜（翌営業日）は OK", () => {
    const mon = new Date(2026, 3, 27);
    expect(isAtLeastNextBusinessDay("2026-04-28", mon)).toBe(true);
  });

  it("月曜から見て当日（月曜）は NG", () => {
    const mon = new Date(2026, 3, 27);
    expect(isAtLeastNextBusinessDay("2026-04-27", mon)).toBe(false);
  });

  it("金曜から見て月曜（週末スキップ後の翌営業日）は OK", () => {
    const fri = new Date(2026, 3, 24);
    expect(isAtLeastNextBusinessDay("2026-04-27", fri)).toBe(true);
  });

  it("金曜から見て土曜は NG（週末で営業日でない）", () => {
    const fri = new Date(2026, 3, 24);
    expect(isAtLeastNextBusinessDay("2026-04-25", fri)).toBe(false);
  });

  it("金曜から見て火曜は OK（翌営業日より先）", () => {
    const fri = new Date(2026, 3, 24);
    expect(isAtLeastNextBusinessDay("2026-04-28", fri)).toBe(true);
  });

  it("不正日付は false", () => {
    const mon = new Date(2026, 3, 27);
    expect(isAtLeastNextBusinessDay("2026/04/28", mon)).toBe(false);
    expect(isAtLeastNextBusinessDay("", mon)).toBe(false);
  });
});
