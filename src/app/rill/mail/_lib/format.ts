import type { RillMailMessage } from "./types";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function parts(value: string, timeZone = "Asia/Tokyo") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => formatted.find((p) => p.type === type)?.value ?? "";
  const localDate = new Date(date.toLocaleString("en-US", { timeZone }));
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), weekday: WEEKDAYS[localDate.getDay()] };
}

export function formatMailListDate(value: string, timeZone?: string) {
  const p = parts(value, timeZone);
  return p ? `${p.year.slice(-2)}/${p.month}/${p.day}(${p.weekday}) ${p.hour}:${p.minute}` : "";
}

export function formatMailDetailDate(value: string, timeZone?: string) {
  const p = parts(value, timeZone);
  return p ? `${p.year}/${p.month}/${p.day}(${p.weekday}) ${p.hour}:${p.minute}` : "";
}

export function mergeMessages(groups: RillMailMessage[][]) {
  return groups.flat().sort((a, b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime));
}

export function abbreviateBox(label: string) {
  const cleaned = label.replace(/メールボックス|共有|株式会社|合同会社|有限会社|\s/gu, "");
  if (!cleaned) return "箱";
  if (/^[a-z0-9_-]+$/iu.test(cleaned)) return cleaned.slice(0, 6).toUpperCase();
  return Array.from(cleaned).slice(0, 3).join("");
}

export function reviewerInitials(categories: string[], knownNames: string[]) {
  const names = new Set(knownNames);
  return categories.filter((category) => names.has(category)).map((category) => Array.from(category)[0] ?? "");
}

export function statusCategory(categories: string[]) {
  return ["要対応", "確認中", "処理済"].find((status) => categories.includes(status)) ?? null;
}
