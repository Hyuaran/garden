import type { RillMailMessage } from "./types";
import { hasOwnPin } from "./write-ops";

export const PINNED_PAGE_SIZE = 100;
export const PINNED_BOX_LIMIT = 500;
export const RECENT_WRITE_TTL_MS = 60_000;

export type RecentCategoryWrite = { categories: string[]; isRead?: boolean; expiresAt: number };

export type PinnedMessagesResponse = {
  messages: RillMailMessage[];
  truncated: boolean;
  count: number;
  notice?: string;
};

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
