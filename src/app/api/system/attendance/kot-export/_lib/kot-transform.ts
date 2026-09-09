import { isJapaneseHoliday } from "@/app/system/kanri/_lib/jp-holidays";
import type { PunchType } from "@/app/system/_lib/attendance";

export type KotTransformPunch = {
  id?: number;
  punch_type: PunchType;
  punched_at: string;
};

export type KotTransformedPunch = {
  punch_type: PunchType;
  punched_at: string;
  source_punch_id?: number;
};

export type KotTransformIssue = {
  level: "needs_check";
  message: string;
};

export type KotTransformResult = {
  punches: KotTransformedPunch[];
  issues: KotTransformIssue[];
  breakIncluded: boolean;
  roundedClockIn: string | null;
  roundedClockOut: string | null;
};

const LUNCH_START = 13 * 60;
const LUNCH_END = 14 * 60;
const WINDOW_END = 21 * 60;

function jstParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("打刻日時が不正です");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    minute: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

function toIsoFromJstMinute(date: string, minute: number) {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error("日付はYYYY-MM-DD形式で指定してください");
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 0, minute) - 9 * 60 * 60 * 1000).toISOString();
}

function timeText(minute: number) {
  const hour = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isWeekendOrHoliday(date: string) {
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", weekday: "short" }).format(new Date(`${date}T00:00:00+09:00`));
  return day === "Sat" || day === "Sun" || isJapaneseHoliday(date);
}

function byPunchedAt(left: KotTransformPunch, right: KotTransformPunch) {
  const time = new Date(left.punched_at).getTime() - new Date(right.punched_at).getTime();
  return time || (left.id ?? 0) - (right.id ?? 0);
}

export function toJstDate(value: string) {
  return jstParts(value).date;
}

export function transformDayPunches(input: {
  date: string;
  punches: KotTransformPunch[];
  isOffice: boolean;
}): KotTransformResult {
  const punches = [...input.punches].sort(byPunchedAt);
  if (input.isOffice) {
    return {
      punches: punches.map((punch) => ({ punch_type: punch.punch_type, punched_at: punch.punched_at, source_punch_id: punch.id })),
      issues: [],
      breakIncluded: punches.some((punch) => punch.punch_type === "break_start" || punch.punch_type === "break_end"),
      roundedClockIn: null,
      roundedClockOut: null,
    };
  }

  const clockIn = punches.find((punch) => punch.punch_type === "clock_in");
  const clockOut = punches.filter((punch) => punch.punch_type === "clock_out").at(-1);
  if (!clockIn || !clockOut) {
    return {
      punches: [],
      issues: [{ level: "needs_check", message: "出勤または退勤の打刻が足りません" }],
      breakIncluded: false,
      roundedClockIn: null,
      roundedClockOut: null,
    };
  }

  const windowStart = (isWeekendOrHoliday(input.date) ? 10 : 14) * 60;
  const rawStart = jstParts(clockIn.punched_at).minute;
  const rawEnd = jstParts(clockOut.punched_at).minute;
  const start = Math.max(Math.ceil(rawStart / 30) * 30, windowStart);
  const end = Math.min(Math.floor(rawEnd / 30) * 30, WINDOW_END);
  if (start >= end) {
    return {
      punches: [],
      issues: [{ level: "needs_check", message: "要確認（枠の外で終了）" }],
      breakIncluded: false,
      roundedClockIn: timeText(start),
      roundedClockOut: timeText(end),
    };
  }

  const result: KotTransformedPunch[] = [
    { punch_type: "clock_in", punched_at: toIsoFromJstMinute(input.date, start), source_punch_id: clockIn.id },
  ];
  const breakIncluded = start <= LUNCH_START && end >= LUNCH_END;
  if (breakIncluded) {
    result.push(
      { punch_type: "break_start", punched_at: toIsoFromJstMinute(input.date, LUNCH_START) },
      { punch_type: "break_end", punched_at: toIsoFromJstMinute(input.date, LUNCH_END) },
    );
  }
  result.push({ punch_type: "clock_out", punched_at: toIsoFromJstMinute(input.date, end), source_punch_id: clockOut.id });
  return {
    punches: result,
    issues: [],
    breakIncluded,
    roundedClockIn: timeText(start),
    roundedClockOut: timeText(end),
  };
}
