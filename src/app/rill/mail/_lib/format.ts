import type { RillMailMessage } from "./types";
import { MAIL_STATES } from "./write-ops";

const FORMATTERS = new Map<string, Intl.DateTimeFormat>();
type MailDateParts = { year: string; month: string; day: string; hour: string; minute: string; weekday: string };
const DATE_PARTS = new Map<string, MailDateParts | null>();
const VIEWABLE_ATTACHMENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIEWABLE_ATTACHMENT_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp"]);
const MESSAGE_TIMESTAMPS = new WeakMap<RillMailMessage, number>();

export function isViewableAttachment(contentType: string | null | undefined, name: string) {
  const normalizedType = contentType?.split(";", 1)[0].trim().toLocaleLowerCase("en-US");
  if (normalizedType) return VIEWABLE_ATTACHMENT_TYPES.has(normalizedType);
  const extension = name.trim().split(".").pop()?.toLocaleLowerCase("en-US") ?? "";
  return name.includes(".") && VIEWABLE_ATTACHMENT_EXTENSIONS.has(extension);
}

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
  const cacheKey = `${timeZone}:${value}`;
  if (DATE_PARTS.has(cacheKey)) return DATE_PARTS.get(cacheKey) ?? null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) { DATE_PARTS.set(cacheKey, null); return null; }
  const formatted = formatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => formatted.find((p) => p.type === type)?.value ?? "";
  const result = { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), weekday: get("weekday") };
  DATE_PARTS.set(cacheKey, result);
  return result;
}

function timestamp(message: RillMailMessage) {
  const cached = MESSAGE_TIMESTAMPS.get(message);
  if (cached !== undefined) return cached;
  const value = Date.parse(message.receivedDateTime);
  const normalized = Number.isNaN(value) ? Number.NEGATIVE_INFINITY : value;
  MESSAGE_TIMESTAMPS.set(message, normalized);
  return normalized;
}

const messageKey = (message: RillMailMessage) => `${message.box.id}:${message.id}`;
const sameStrings = (left: string[], right: string[]) => left.length === right.length && left.every((value, index) => value === right[index]);

function sameMessage(left: RillMailMessage, right: RillMailMessage) {
  return left.id === right.id
    && left.subject === right.subject
    && left.fromName === right.fromName
    && left.fromAddress === right.fromAddress
    && left.receivedDateTime === right.receivedDateTime
    && left.hasAttachments === right.hasAttachments
    && left.isRead === right.isRead
    && left.bodyPreview === right.bodyPreview
    && left.box.id === right.box.id
    && left.box.address === right.box.address
    && left.box.label === right.box.label
    && left.box.kind === right.box.kind
    && sameStrings(left.to, right.to)
    && sameStrings(left.categories, right.categories);
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
  if (!incoming.length) return current;
  const existing = new Map(current.map((message) => [messageKey(message), message]));
  const incomingKeys = new Set(incoming.map(messageKey));
  const normalizedIncoming = incoming.map((message) => {
    const previous = existing.get(messageKey(message));
    return previous && sameMessage(previous, message) ? previous : message;
  });
  const retained = current.filter((message) => !incomingKeys.has(messageKey(message)));
  const retainedTimes = retained.map(timestamp);
  const incomingTimes = normalizedIncoming.map(timestamp);
  const merged: RillMailMessage[] = [];
  let left = 0;
  let right = 0;
  while (left < retained.length || right < normalizedIncoming.length) {
    if (right >= normalizedIncoming.length || (left < retained.length && retainedTimes[left] >= incomingTimes[right])) merged.push(retained[left++]);
    else merged.push(normalizedIncoming[right++]);
  }
  return merged.length === current.length && merged.every((message, index) => message === current[index]) ? current : merged;
}

export function pruneToRefreshWindow(current: RillMailMessage[], incoming: RillMailMessage[], refreshedBoxIds?: string[]) {
  const included = new Set(refreshedBoxIds ?? incoming.map((message) => message.box.id));
  const incomingKeys = new Set(incoming.map((message) => `${message.box.id}:${message.id}`));
  const boxesWithIncoming = new Set<string>();
  const oldestByBox = new Map<string, number>();
  incoming.forEach((message) => {
    const boxId = message.box.id;
    boxesWithIncoming.add(boxId);
    const value = timestamp(message);
    if (Number.isFinite(value)) oldestByBox.set(boxId, Math.min(oldestByBox.get(boxId) ?? value, value));
  });

  const pruned = current.filter((message) => {
    const boxId = message.box.id;
    if (!included.has(boxId)) return true;
    if (!boxesWithIncoming.has(boxId)) return false;
    const oldest = oldestByBox.get(boxId);
    const currentTime = timestamp(message);
    if (oldest === undefined || !Number.isFinite(currentTime) || currentTime < oldest) return true;
    return incomingKeys.has(`${boxId}:${message.id}`);
  });
  return pruned.length === current.length ? current : pruned;
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
