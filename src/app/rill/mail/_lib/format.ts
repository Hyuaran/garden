import type { RillMailMessage } from "./types";
import { MAIL_STATES } from "./write-ops";

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let value = FORMATTERS.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("ja-JP", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    FORMATTERS.set(timeZone, value);
  }
  return value;
}

function parts(value: string, timeZone = "Asia/Tokyo") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = formatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => formatted.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), weekday: get("weekday") };
}

function timestamp(message: RillMailMessage) {
  const value = Date.parse(message.receivedDateTime);
  return Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
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
  return groups.flat().sort((a, b) => timestamp(b) - timestamp(a));
}

export function mergeMessagePages(current: RillMailMessage[], incoming: RillMailMessage[]) {
  const byKey = new Map(current.map((message) => [`${message.box.id}:${message.id}`, message]));
  incoming.forEach((message) => byKey.set(`${message.box.id}:${message.id}`, message));
  return [...byKey.values()].sort((a, b) => timestamp(b) - timestamp(a));
}

export function pruneToRefreshWindow(current: RillMailMessage[], incoming: RillMailMessage[], refreshedBoxIds?: string[]) {
  const included = new Set(refreshedBoxIds ?? incoming.map((message) => message.box.id));
  const incomingKeys = new Set(incoming.map((message) => `${message.box.id}:${message.id}`));
  const incomingByBox = new Map<string, RillMailMessage[]>();
  incoming.forEach((message) => incomingByBox.set(message.box.id, [...(incomingByBox.get(message.box.id) ?? []), message]));
  const oldestByBox = new Map<string, number>();
  incomingByBox.forEach((messages, boxId) => {
    const valid = messages.map(timestamp).filter((value) => Number.isFinite(value));
    if (valid.length) oldestByBox.set(boxId, Math.min(...valid));
  });

  return current.filter((message) => {
    const boxId = message.box.id;
    if (!included.has(boxId)) return true;
    const boxIncoming = incomingByBox.get(boxId) ?? [];
    if (!boxIncoming.length) return false;
    const oldest = oldestByBox.get(boxId);
    const currentTime = timestamp(message);
    if (oldest === undefined || !Number.isFinite(currentTime) || currentTime < oldest) return true;
    return incomingKeys.has(`${boxId}:${message.id}`);
  });
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

export function reviewerTone(name: string, reviewers: string[]) {
  const index = reviewers.indexOf(name);
  return (index < 0 ? 0 : index) % 4;
}

export function statusCategory(categories: string[]) {
  return MAIL_STATES.find((status) => categories.includes(status)) ?? null;
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
  const today = dateKey(now.toISOString(), timeZone);
  const yesterday = priorDateKey(today);
  let previous = "";
  return messages.map((message) => {
    const key = dateKey(message.receivedDateTime, timeZone);
    const p = key ? parts(message.receivedDateTime, timeZone) : null;
    const label = key === today ? "今日" : key === yesterday ? "昨日" : p ? `${p.month}/${p.day}(${p.weekday})` : "";
    const showDay = Boolean(label) && label !== previous;
    if (label) previous = label;
    return { message, label, showDay };
  });
}
