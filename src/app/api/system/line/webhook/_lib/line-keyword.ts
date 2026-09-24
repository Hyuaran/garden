export type LineSummaryKeyword =
  | { kind: "day"; summaryKeyword: string; dateOffset: 0 | -1 }
  | { kind: "date"; summaryKeyword: string; date: string }
  | { kind: "month"; summaryKeyword: string };

export type LineKeywordCommand = LineSummaryKeyword | { kind: "list" };

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function findSummaryPrefix(text: string, summaryKeywords: readonly string[]) {
  const normalized = text.trimStart();
  return [...summaryKeywords]
    .sort((left, right) => right.length - left.length)
    .find((keyword) => normalized.toLocaleLowerCase().startsWith(keyword.toLocaleLowerCase())) ?? null;
}

export function parseLineSummaryKeyword(text: string, summaryKeywords: readonly string[] = ["NHK"]): LineKeywordCommand | null {
  const normalized = text.trim();
  if (normalized === "合言葉") return { kind: "list" };

  const summaryKeyword = findSummaryPrefix(normalized, summaryKeywords);
  if (!summaryKeyword) return null;

  // 「NHK集計 昨日」「NHK集計　20260924」のように空白（半角・全角）が入っても同じ扱いにする
  const rest = normalized.slice(summaryKeyword.length).replace(/[\s　]+/g, "");
  if (rest === "集計") return { kind: "day", summaryKeyword, dateOffset: 0 };
  if (rest === "集計昨日") return { kind: "day", summaryKeyword, dateOffset: -1 };
  if (rest === "今月" || rest === "今月の集計") return { kind: "month", summaryKeyword };

  const match = rest.match(/^集計(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!validDate(year, month, day)) return null;
  return { kind: "date", summaryKeyword, date: `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
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
