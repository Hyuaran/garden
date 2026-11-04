import { isJapaneseHoliday } from "@/app/system/kanri/_lib/jp-holidays";
export const DEFAULT_SHIFT_START_MONTH = "2026-12";
export type ShiftDay = {
  work_date: string;
  start_time: string | null;
  end_time?: string | null;
  day_kind?: "work" | "rest" | "paid";
};
export type DefaultPattern = {
  weekday: number;
  start_time: string | null;
  end_time: string | null;
};
export const halfHourTimes = Array.from({ length: 36 }, (_, i) =>
  `${String(6 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
);
export function defaultDays(month: string, pattern: DefaultPattern[]): ShiftDay[] {
  return monthDays(month).map(work_date => {
    const weekday = isJapaneseHoliday(work_date)
      ? 8 : new Date(work_date + "T00:00:00Z").getUTCDay();
    const row = pattern.find(row => row.weekday === weekday);
    return {
      work_date,
      start_time: row?.start_time?.slice(0, 5) ?? null,
      end_time: row?.end_time?.slice(0, 5) ?? null,
      day_kind: row?.start_time ? "work" : "rest",
    };
  });
}
export function patternReady(pattern: DefaultPattern[]) {
  return [0, 1, 2, 3, 4, 5, 6, 8].every(day => pattern.some(row => row.weekday === day));
}
export function validateDefaultDays(
  month: string,
  input: unknown,
  pattern: DefaultPattern[],
  manager = false,
): ShiftDay[] {
  if (!Array.isArray(input) || input.length !== monthDays(month).length)
    throw new Error("すべての日のシフトを入力してください。");
  return defaultDays(month, pattern).map(base => {
    const matches = input.filter(row => row?.work_date === base.work_date);
    const row = matches[0];
    const kind = row?.day_kind;
    if (matches.length !== 1 || !["work", "rest", "paid"].includes(kind))
      throw new Error("勤務・休み・有給を選んでください。");
    if (kind !== "work") {
      if (row.start_time !== null || row.end_time !== null)
        throw new Error("休み・有給には時刻を指定できません。");
      return { work_date: base.work_date, start_time: null, end_time: null, day_kind: kind };
    }
    if (!halfHourTimes.includes(row.start_time) ||
        ![...halfHourTimes, "24:00"].includes(row.end_time) || row.start_time >= row.end_time ||
        (!manager && (row.start_time !== base.start_time || row.end_time !== base.end_time)))
      throw new Error(manager ? "開始と終了を30分単位で入力してください。" : "その日の既定の勤務・休み・有給から選んでください。");
    return { work_date: base.work_date, start_time: row.start_time, end_time: row.end_time, day_kind: "work" };
  });
}
export function monthDays(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("月を確認してください。");
  const [y, m] = month.split("-").map(Number);
  return Array.from(
    { length: new Date(Date.UTC(y, m, 0)).getUTCDate() },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}
export function weekend(date: string) {
  return [0, 6].includes(new Date(date + "T00:00:00Z").getUTCDay()) || isJapaneseHoliday(date);
}
export function startOptions(date: string, manager = false) {
  return Array.from(
    { length: (weekend(date) ? 17 : 9) + (manager ? 5 : 0) },
    (_, i) => `${String((weekend(date) ? 10 : 14) + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`,
  );
}
export function deadline(month: string) {
  monthDays(month);
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 15, 15, 0) - 1);
}
export const closedMessage = "提出の締切を過ぎました。変更は責任者に連絡してください。";
export function validateDays(month: string, input: unknown, manager = false): ShiftDay[] {
  const days = monthDays(month);
  if (!Array.isArray(input) || input.length !== days.length) throw new Error("すべての日のシフトを入力してください。");
  return days.map((work_date) => {
    const matches = input.filter((v) => v?.work_date === work_date);
    const row = matches[0];
    if (
      matches.length !== 1 ||
      (row.start_time !== null && !startOptions(work_date, manager).includes(row.start_time)) ||
      (row.end_time !== undefined && row.end_time !== (row.start_time === null ? null : "21:00"))
    )
      throw new Error(manager
        ? "開始時刻は30分単位で、平日14:00・土日祝10:00から20:30までです。終了は21:00です。"
        : "開始時刻は30分単位で、平日14:00・土日祝10:00から18:00までです。終了は21:00です。");
    return { work_date, start_time: row.start_time };
  });
}
// 休憩は 13:00〜14:00 の 1 時間。この時間を出勤している日は、打刻しなくても休憩したことにする。
export function hasLunchBreak(start: string, end = "21:00") {
  return start.slice(0, 5) <= "13:00" && end.slice(0, 5) >= "14:00";
}
export function hours(start: string | null, end = "21:00") {
  if (!start) return 0;
  const [h, m] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh + em / 60 - h - m / 60 - (hasLunchBreak(start, end) ? 1 : 0);
}
export function confirmDays(rows: ShiftDay[], holidays: string[]) {
  return rows.map((r) => ({
    ...r,
    start_time: holidays.includes(r.work_date) ? null : r.start_time,
    end_time: holidays.includes(r.work_date) || !r.start_time ? null : "21:00",
  }));
}
export function holidayCandidates(days: string[], rows: ShiftDay[]) {
  return days
    .map((work_date) => ({
      work_date,
      hours: rows.filter((r) => r.work_date === work_date).reduce((n, r) => n + hours(r.start_time), 0),
    }))
    .sort((a, b) => a.hours - b.hours || a.work_date.localeCompare(b.work_date));
}
export function stamp(value: string | Date) {
  return new Date(value)
    .toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\//g, "/");
}
