import type { RillMailMessage } from "./types";
import { hasOwnPin } from "./write-ops";

export const PINNED_PAGE_SIZE = 100;
export const PINNED_BOX_LIMIT = 500;

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
