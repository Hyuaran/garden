import { isJapaneseHoliday } from "@/app/system/kanri/_lib/jp-holidays";
export type ShiftDay = { work_date: string; start_time: string | null };
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
export function hasLunchBreak(start: string) {
  return start.slice(0, 5) <= "13:00";
}
export function hours(start: string | null) {
  if (!start) return 0;
  const [h, m] = start.split(":").map(Number);
  return 21 - h - m / 60 - (hasLunchBreak(start) ? 1 : 0);
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
