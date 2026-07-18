import type { RillMailBox, RillMailMessage } from "./types";

export const SEARCH_PAGE_SIZE = 50;
export const PRIORITY_DISTANCE_PX = 2_000;
export const PRIORITY_PAGES_AHEAD = 5;
export const NORMAL_AUTO_PAGE_LIMIT = 10;

export function normalizeSearchQuery(value: string | null) {
  const query = value?.trim() ?? "";
  if (!query) throw new Error("Search query is required");
  return query;
}

export function escapeGraphSearchQuery(query: string) {
  return query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function selectSearchBoxes(boxes: RillMailBox[], requested: string) {
  if (requested === "all") return boxes;
  const selected = boxes.filter((box) => box.id === requested || box.address === requested);
  if (!selected.length) throw new Error("Mailbox not found");
  return selected;
}

export function mergeSearchResults(groups: RillMailMessage[][]) {
  const unique = new Map<string, RillMailMessage>();
  groups.flat().forEach((message) => unique.set(`${message.box.id}:${message.id}`, message));
  return [...unique.values()].sort((a, b) => Date.parse(b.receivedDateTime) - Date.parse(a.receivedDateTime));
}

export type ScrollMetrics = Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">;

export function isNearListEnd(metrics: ScrollMetrics, threshold = PRIORITY_DISTANCE_PX) {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= threshold;
}

export function canPrefetchPage(input: { cursor: string | null; loading: boolean; priorityPages: number; automaticPageCount: number }) {
  if (!input.cursor || input.loading) return false;
  return input.priorityPages > 0 || input.automaticPageCount < NORMAL_AUTO_PAGE_LIMIT;
}
