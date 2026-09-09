import { describe, expect, it } from "vitest";
import { formatKotJstDateTime } from "./kot-csv";
import { transformDayPunches, type KotTransformPunch } from "./kot-transform";

const punch = (punch_type: KotTransformPunch["punch_type"], time: string, id = 1): KotTransformPunch => ({
  id,
  punch_type,
  punched_at: new Date(`${time}+09:00`).toISOString(),
});

function formatted(result: ReturnType<typeof transformDayPunches>) {
  return result.punches.map((row) => [row.punch_type, formatKotJstDateTime(row.punched_at)]);
}

describe("transformDayPunches", () => {
  it("rounds and clamps weekday sales punches", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: false, punches: [
      punch("clock_in", "2026-09-09T13:26", 1),
      punch("clock_out", "2026-09-09T21:02", 2),
    ] });
    expect(formatted(result)).toEqual([
      ["clock_in", "202609091400"],
      ["clock_out", "202609092100"],
    ]);
    expect(result.breakIncluded).toBe(false);
  });

  it("uses the weekend window and inserts only the 13:00-14:00 break when fully covered", () => {
    const result = transformDayPunches({ date: "2026-09-12", isOffice: false, punches: [
      punch("clock_in", "2026-09-12T09:30", 1),
      punch("clock_out", "2026-09-12T21:10", 2),
      punch("break_start", "2026-09-12T16:00", 3),
      punch("break_end", "2026-09-12T16:10", 4),
    ] });
    expect(formatted(result)).toEqual([
      ["clock_in", "202609121000"],
      ["break_start", "202609121300"],
      ["break_end", "202609121400"],
      ["clock_out", "202609122100"],
    ]);
  });

  it("rounds partial sales times without a break", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: false, punches: [
      punch("clock_in", "2026-09-09T15:37", 1),
      punch("clock_out", "2026-09-09T21:03", 2),
    ] });
    expect(formatted(result)).toEqual([
      ["clock_in", "202609091600"],
      ["clock_out", "202609092100"],
    ]);
  });

  it("keeps field sales inside the same sales rule", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: false, punches: [
      punch("clock_in", "2026-09-09T08:12", 1),
      punch("clock_out", "2026-09-09T18:30", 2),
    ] });
    expect(formatted(result)).toEqual([
      ["clock_in", "202609091400"],
      ["clock_out", "202609091830"],
    ]);
  });

  it("leaves office punches untouched including breaks", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: true, punches: [
      punch("clock_in", "2026-09-09T09:52", 1),
      punch("break_start", "2026-09-09T13:02", 2),
      punch("break_end", "2026-09-09T13:47", 3),
      punch("clock_out", "2026-09-09T19:11", 4),
    ] });
    expect(formatted(result)).toEqual([
      ["clock_in", "202609090952"],
      ["break_start", "202609091302"],
      ["break_end", "202609091347"],
      ["clock_out", "202609091911"],
    ]);
  });

  it("does not send a sales day ending outside the window", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: false, punches: [
      punch("clock_in", "2026-09-09T09:00", 1),
      punch("clock_out", "2026-09-09T13:00", 2),
    ] });
    expect(result.punches).toEqual([]);
    expect(result.issues[0]?.message).toContain("枠の外");
  });

  it("does not send a sales day with only one side punched", () => {
    const result = transformDayPunches({ date: "2026-09-09", isOffice: false, punches: [
      punch("clock_in", "2026-09-09T14:00", 1),
    ] });
    expect(result.punches).toEqual([]);
    expect(result.issues[0]?.message).toContain("足りません");
  });
});
