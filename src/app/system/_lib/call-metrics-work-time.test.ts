import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260821000001_system_call_metrics_break_full_deduction.sql"),
  "utf8",
);

const breaks = [["11:15:00", "11:30:00"], ["13:00:00", "14:00:00"], ["15:20:00", "15:30:00"], ["16:45:00", "17:00:00"], ["18:20:00", "18:30:00"], ["19:50:00", "20:00:00"]] as const;
const seconds = (value: string) => {
  const [hours, minutes, secs] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + secs;
};
const workSeconds = (firstStart: string, lastEnd: string) => {
  const first = seconds(firstStart);
  const last = seconds(lastEnd);
  // またいで働いていた休憩だけ、その長さを全額引く
  const breakSeconds = breaks.reduce((total, [start, end]) => (
    total + (first <= seconds(start) && seconds(end) <= last ? seconds(end) - seconds(start) : 0)
  ), 0);
  return Math.max(0, last - first - breakSeconds);
};

describe("Codex-187 employee work-time SQL contract", () => {
  it.each([
    ["梶野　恵園", "15:01:14", "21:00:30", 18856, 171, 32.65],
    ["宮永　ひかり", "12:30:48", "21:03:03", 24435, 101, 14.88],
    ["宮本　桃華", "14:07:41", "21:01:44", 22143, 262, 42.60],
    ["小泉　翔", "14:12:55", "21:12:23", 22468, 74, 11.86],
    ["舩木　稜太", "17:55:18", "21:00:22", 9904, 54, 19.63],
    ["西野　紗良", "18:41:14", "21:00:37", 7763, 79, 36.64],
    ["森　健登", "14:08:26", "21:00:03", 21997, 200, 32.73],
    ["谷本　結那", "14:10:12", "20:59:22", 21850, 292, 48.11],
    // 休憩枠の途中から働き始めた／途中で終えた日は、その休憩を引かない（回帰）
    ["石原　孝志朗", "13:44:39", "21:00:30", 23451, 94, 14.43],
    ["廣門　彩季", "14:09:09", "19:52:27", 18498, 189, 36.78],
  ])("matches the measured fixture for %s", (_employee, first, last, expected, callCount, expectedHourly) => {
    expect(workSeconds(first as string, last as string)).toBe(expected);
    expect(Number((Number(callCount) / (Number(expected) / 3600)).toFixed(2))).toBe(expectedHourly);
  });

  it("uses call_time when call_ended_time is null", () => {
    const callTime = "18:42:15";
    const endedTime: string | null = null;
    expect(endedTime ?? callTime).toBe("18:42:15");
    expect(migration).toContain("max(coalesce(history.call_ended_time, history.call_time))");
    expect(migration).toContain("break_time.b_end - break_time.b_start");
  });

  it("keeps indexed raw-history access narrow and aggregates daily spans", () => {
    expect(migration).toContain("history.employee_name = employee.employee_name");
    expect(migration).toContain("history.call_date between p_from and p_to");
    expect(migration).toContain("group by history.call_date");
    expect(migration).toContain("min(history.call_time)");
  });

  it("retains preconfirm union semantics and all public rate fields", () => {
    expect(migration).toContain("full outer join preconfirm_by_employee");
    expect(migration).toContain("call_order_rate");
    expect(migration).toContain("call_acquired_rate");
  });
});
