import type { RillMailBox, RillMailMessage } from "./types";

export const SEARCH_PAGE_SIZE = 50;
export const PRIORITY_DISTANCE_PX = 2_000;
export const PRIORITY_PAGES_AHEAD = 5;
export const NORMAL_AUTO_PAGE_LIMIT = 10;
export const AUTO_SEARCH_DELAY_MS = 600;

export type SearchMessagesResponse = {
  messages: RillMailMessage[];
  truncated: boolean;
};

export function shouldApplySearchResult(resultGeneration: number, currentGeneration: number) {
  return resultGeneration === currentGeneration;
}

export function anySearchTruncated(groups: boolean[]) {
  return groups.some(Boolean);
}

export class SerialSearchScheduler<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: { value: T; generation: number } | null = null;
  private running = false;
  private generation = 0;

  constructor(
    private readonly run: (value: T, generation: number) => Promise<void>,
    private readonly busy: (value: boolean) => void = () => undefined,
    private readonly delay = AUTO_SEARCH_DELAY_MS,
  ) {}

  schedule(value: T, immediate = false) {
    this.generation += 1;
    const task = { value, generation: this.generation };
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (immediate) {
      this.pending = task;
      void this.drain();
    } else {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.pending = task;
        void this.drain();
      }, this.delay);
    }
    return task.generation;
  }

  clear() {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
    this.busy(false);
  }

  dispose() {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  isCurrent(generation: number) { return shouldApplySearchResult(generation, this.generation); }

  private async drain() {
    if (this.running || !this.pending) return;
    const task = this.pending;
    this.pending = null;
    this.running = true;
    this.busy(true);
    try { await this.run(task.value, task.generation); }
    finally {
      this.running = false;
      if (this.pending) void this.drain();
      else this.busy(false);
    }
  }
}

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
