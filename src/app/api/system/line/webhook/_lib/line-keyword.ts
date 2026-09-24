export type LineSummaryKeyword =
  | { kind: "day"; dateOffset: 0 | -1 }
  | { kind: "date"; date: string }
  | { kind: "month" };

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseLineSummaryKeyword(text: string): LineSummaryKeyword | null {
  const normalized = text.trim();
  if (normalized === "集計") return { kind: "day", dateOffset: 0 };
  if (normalized === "昨日の集計") return { kind: "day", dateOffset: -1 };
  if (normalized === "今月の集計") return { kind: "month" };

  const match = normalized.match(/^(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})\s*集計$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!validDate(year, month, day)) return null;
  return { kind: "date", date: `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

export function todayJst(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function monthOf(date: string) {
  return date.slice(0, 7);
}
