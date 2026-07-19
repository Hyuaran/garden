import type { RillMailMessage } from "./types";
import { hasOwnPin, toggleOwnPin } from "./write-ops";

export const PINNED_PAGE_SIZE = 100;
export const PINNED_BOX_LIMIT = 500;
export const RECENT_WRITE_TTL_MS = 60_000;
export const PIN_OVERRIDE_TTL_MS = 10 * 60_000;

export type RecentCategoryWrite = { categories: string[]; isRead?: boolean; expiresAt: number };
export type PinOverride = { ownPinned: boolean; expiresAt: number };
export type PinOverrideStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type PinnedMessagesResponse = {
  messages: RillMailMessage[];
  truncated: boolean;
  count: number;
  notice?: string;
};

export type PinSortOrder = "newest" | "oldest";

export function sortPinnedMessages(messages: RillMailMessage[], order: PinSortOrder) {
  const direction = order === "newest" ? -1 : 1;
  return messages.map((message, index) => ({ message, index })).sort((a, b) => {
    const aTime = Date.parse(a.message.receivedDateTime);
    const bTime = Date.parse(b.message.receivedDateTime);
    const dated = (Number.isFinite(aTime) ? aTime : 0) - (Number.isFinite(bTime) ? bTime : 0);
    return dated === 0 ? a.index - b.index : dated * direction;
  }).map(({ message }) => message);
}

export function toggleVisibleSelection(current: ReadonlySet<string>, visibleKeys: string[]) {
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => current.has(key));
  return allVisibleSelected ? new Set<string>() : new Set(visibleKeys);
}

export function pinnedCategoryFilter(ownName: string) {
  const category = `ピン:${ownName}`.replace(/'/g, "''");
  return `categories/any(c: c eq '${category}')`;
}

export function pinnedPagingDecision(collected: number, hasNextPage: boolean, limit = PINNED_BOX_LIMIT) {
  return { stop: !hasNextPage || collected >= limit, truncated: hasNextPage && collected >= limit };
}

export function mergePinnedMessages(groups: RillMailMessage[][]) {
  const unique = new Map<string, RillMailMessage>();
  groups.flat().forEach((message) => unique.set(`${message.box.id}:${message.id}`, message));
  return [...unique.values()].sort((a, b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime));
}

export function reconcilePinnedMessage(messages: RillMailMessage[], updated: RillMailMessage, ownName: string) {
  const key = `${updated.box.id}:${updated.id}`;
  const remaining = messages.filter((message) => `${message.box.id}:${message.id}` !== key);
  return hasOwnPin(updated.categories, ownName) ? mergePinnedMessages([remaining, [updated]]) : remaining;
}

export function applyRecentCategoryWrites(
  messages: RillMailMessage[],
  writes: ReadonlyMap<string, RecentCategoryWrite>,
  now: number,
  options: { pinnedView?: boolean; ownName?: string } = {},
) {
  const activeWrites = new Map([...writes].filter(([, write]) => write.expiresAt > now));
  const corrected = messages.map((message) => {
    const write = activeWrites.get(`${message.box.id}:${message.id}`);
    return write ? { ...message, categories: [...write.categories], ...(write.isRead === undefined ? {} : { isRead: write.isRead }) } : message;
  });
  return {
    messages: options.pinnedView && options.ownName
      ? corrected.filter((message) => hasOwnPin(message.categories, options.ownName!))
      : corrected,
    writes: activeWrites,
  };
}

export function shouldAddBulkPin(messages: RillMailMessage[], ownName: string) {
  return !messages.length || !messages.every((message) => hasOwnPin(message.categories, ownName));
}

export function pinOverrideStorageKey(userId: string) { return `rill-mail-pin-overrides:${userId}`; }

export function loadPinOverrides(storage: PinOverrideStorage | null, userId: string, now: number) {
  const active = new Map<string, PinOverride>();
  if (!storage || !userId) return active;
  try {
    const parsed = JSON.parse(storage.getItem(pinOverrideStorageKey(userId)) ?? "{}") as Record<string, PinOverride>;
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value?.ownPinned === "boolean" && typeof value.expiresAt === "number" && value.expiresAt > now) active.set(key, value);
    });
    writePinOverrides(storage, userId, active);
  } catch { try { storage.removeItem(pinOverrideStorageKey(userId)); } catch { /* storage unavailable */ } }
  return active;
}

export function savePinOverride(storage: PinOverrideStorage | null, userId: string, messageKey: string, ownPinned: boolean, now: number) {
  const active = loadPinOverrides(storage, userId, now);
  active.set(messageKey, { ownPinned, expiresAt: now + PIN_OVERRIDE_TTL_MS });
  if (storage && userId) writePinOverrides(storage, userId, active);
  return active;
}

export function removePinOverride(storage: PinOverrideStorage | null, userId: string, messageKey: string, now: number) {
  const active = loadPinOverrides(storage, userId, now);
  active.delete(messageKey);
  if (storage && userId) writePinOverrides(storage, userId, active);
  return active;
}

function writePinOverrides(storage: PinOverrideStorage, userId: string, overrides: ReadonlyMap<string, PinOverride>) {
  try {
    const key = pinOverrideStorageKey(userId);
    if (!overrides.size) { storage.removeItem(key); return; }
    storage.setItem(key, JSON.stringify(Object.fromEntries(overrides)));
  } catch { /* private mode/quota failures must not break mail writes */ }
}

export function applyPinOverrides(
  messages: RillMailMessage[],
  overrides: ReadonlyMap<string, PinOverride>,
  ownName: string,
  options: { pinnedView?: boolean; protectedKeys?: ReadonlySet<string> } = {},
) {
  const corrected = messages.map((message) => {
    const key = `${message.box.id}:${message.id}`;
    const override = options.protectedKeys?.has(key) ? undefined : overrides.get(key);
    return override ? { ...message, categories: toggleOwnPin(message.categories, ownName, override.ownPinned) } : message;
  });
  return options.pinnedView ? corrected.filter((message) => hasOwnPin(message.categories, ownName)) : corrected;
}
