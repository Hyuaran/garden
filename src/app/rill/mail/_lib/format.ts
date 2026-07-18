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

export function mergeMessagePages(current: RillMailMessage[], incoming: RillMailMessage[]) {
  const byKey = new Map(current.map((message) => [`${message.box.id}:${message.id}`, message]));
  incoming.forEach((message) => byKey.set(`${message.box.id}:${message.id}`, message));
  return [...byKey.values()].sort((a, b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime));
}

export function mergeBoxCursors(current: Record<string, string | null>, incoming: Record<string, string | null>) {
  return { ...current, ...incoming };
}

export function abbreviateBox(address: string) {
  return (address.split("@")[0] || address || "box").trim().toLocaleLowerCase("en-US");
}

export function reviewerInitials(categories: string[], knownNames: string[]) {
  return reviewerNames(categories, knownNames).map((category) => Array.from(category)[0] ?? "");
}

export function reviewerNames(categories: string[], knownNames: string[]) {
  const names = new Set(knownNames);
  return categories.filter((category) => names.has(category));
}

export function reviewerTone(name: string) {
  const fixed: Record<string, number> = { "東": 0, "上": 1, "簡": 2, "金": 3 };
  const initial = Array.from(name)[0] ?? "";
  if (fixed[initial] !== undefined) return fixed[initial];
  return Array.from(name).reduce((sum, character) => sum + (character.codePointAt(0) ?? 0), 0) % 4;
}

export function statusCategory(categories: string[]) {
  return ["要対応", "確認中", "処理済"].find((status) => categories.includes(status)) ?? null;
}

function dateKey(value: string, timeZone = "Asia/Tokyo") {
  const p = parts(value, timeZone);
  return p ? `${p.year}-${p.month}-${p.day}` : "";
}

function priorDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function mailDayLabel(value: string, now = new Date(), timeZone = "Asia/Tokyo") {
  const key = dateKey(value, timeZone);
  const today = dateKey(now.toISOString(), timeZone);
  if (!key) return "";
  if (key === today) return "今日";
  if (key === priorDateKey(today)) return "昨日";
  const p = parts(value, timeZone);
  return p ? `${p.month}/${p.day}(${p.weekday})` : "";
}

export function daySeparatedMessages(messages: RillMailMessage[], now = new Date(), timeZone = "Asia/Tokyo") {
  let previous = "";
  return messages.map((message) => {
    const label = mailDayLabel(message.receivedDateTime, now, timeZone);
    const showDay = label !== previous;
    previous = label;
    return { message, label, showDay };
  });
}
