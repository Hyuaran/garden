const HOLIDAYS = new Set([
  "2026-01-01",
  "2026-01-12",
  "2026-02-11",
  "2026-02-23",
  "2026-03-20",
  "2026-04-29",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  "2026-05-06",
  "2026-07-20",
  "2026-08-11",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-10-12",
  "2026-11-03",
  "2026-11-23",
  "2027-01-01",
  "2027-01-11",
  "2027-02-11",
  "2027-02-23",
  "2027-03-21",
  "2027-03-22",
  "2027-04-29",
  "2027-05-03",
  "2027-05-04",
  "2027-05-05",
  "2027-07-19",
  "2027-08-11",
  "2027-09-20",
  "2027-09-23",
  "2027-10-11",
  "2027-11-03",
  "2027-11-23",
]);

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function todayJst(now = new Date()): string {
  return formatDate(new Date(now.getTime() + JST_OFFSET_MS));
}

export function nowJstText(now = new Date()): string {
  const shifted = new Date(now.getTime() + JST_OFFSET_MS);
  const date = formatDate(shifted);
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${date} ${hh}:${mm}:${ss}`;
}

export function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function parseDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`invalid_date:${value}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function isYearEndHoliday(value: string): boolean {
  const [, month, day] = value.split("-");
  return (month === "12" && Number(day) >= 30) || (month === "01" && Number(day) <= 3);
}

export function isBusinessDay(value: string): boolean {
  const date = parseDate(value);
  const day = date.getUTCDay();
  return day !== 0 && day !== 6 && !HOLIDAYS.has(value) && !isYearEndHoliday(value);
}

export function previousBusinessDay(value: string): string {
  let cursor = addDays(value, -1);
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, -1);
  return cursor;
}

export function effectivePaymentDate(value: string): string {
  return isBusinessDay(value) ? value : previousBusinessDay(value);
}

export function nextBusinessDay(value: string): string {
  let cursor = addDays(value, 1);
  while (!isBusinessDay(cursor)) cursor = addDays(cursor, 1);
  return cursor;
}

export function monthFromDate(value: string): string {
  return value.slice(0, 7);
}
