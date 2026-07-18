import { afterEach, describe, expect, it, vi } from "vitest";
import { anySearchTruncated, canPrefetchPage, escapeGraphSearchQuery, isNearListEnd, mergeSearchResults, normalizeSearchQuery, selectSearchBoxes, SerialSearchScheduler, shouldApplySearchResult } from "../search";
import type { RillMailBox, RillMailMessage } from "../types";

const boxes: RillMailBox[] = [
  { id: "me", address: "me@example.com", label: "Me", kind: "personal" },
  { id: "team@example.com", address: "team@example.com", label: "Team", kind: "shared" },
];
const message = (id: string, box = boxes[0], date = "2026-01-01T00:00:00Z"): RillMailMessage => ({
  id, box, subject: id, fromName: "A", fromAddress: "a@example.com", to: [], receivedDateTime: date,
  hasAttachments: false, isRead: false, categories: [], bodyPreview: "",
});

describe("Graph mail search helpers", () => {
  it("trims and validates the query", () => {
    expect(normalizeSearchQuery("  project  ")).toBe("project");
    expect(() => normalizeSearchQuery("  ")).toThrow("required");
  });

  it("escapes quotes and backslashes for the quoted Graph search expression", () => {
    expect(escapeGraphSearchQuery('subject:"A\\B"')).toBe('subject:\\"A\\\\B\\"');
  });

  it("fans out all boxes or selects one visible box", () => {
    expect(selectSearchBoxes(boxes, "all")).toEqual(boxes);
    expect(selectSearchBoxes(boxes, "team@example.com")).toEqual([boxes[1]]);
    expect(() => selectSearchBoxes(boxes, "missing")).toThrow("not found");
  });

  it("merges newest first and deduplicates by box and message id", () => {
    const result = mergeSearchResults([
      [message("same", boxes[0], "2026-01-01T00:00:00Z"), message("old", boxes[1], "2025-01-01T00:00:00Z")],
      [message("same", boxes[0], "2026-01-01T00:00:00Z"), message("same", boxes[1], "2027-01-01T00:00:00Z")],
    ]);
    expect(result.map((item) => `${item.box.id}:${item.id}`)).toEqual(["team@example.com:same", "me:same", "team@example.com:old"]);
  });

  it("reports truncation when any mailbox has a next page", () => {
    expect(anySearchTruncated([false, true, false])).toBe(true);
    expect(anySearchTruncated([false, false])).toBe(false);
  });

  it("rejects a stale generation", () => {
    expect(shouldApplySearchResult(2, 3)).toBe(false);
    expect(shouldApplySearchResult(3, 3)).toBe(true);
  });
});

describe("automatic full-period search", () => {
  afterEach(() => vi.useRealTimers());

  it("debounces for 600ms and lets Enter run immediately", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => undefined);
    const scheduler = new SerialSearchScheduler(run);
    scheduler.schedule("auto");
    await vi.advanceTimersByTimeAsync(599);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledWith("auto", 1);
    scheduler.schedule("enter", true);
    await vi.runAllTimersAsync();
    expect(run).toHaveBeenLastCalledWith("enter", 2);
  });

  it("serializes in-flight work and keeps only the latest queued query", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const first = new Promise<void>((resolve) => { release = resolve; });
    const values: string[] = [];
    const run = vi.fn(async (value: string) => { values.push(value); if (value === "a") await first; });
    const scheduler = new SerialSearchScheduler(run);
    scheduler.schedule("a", true);
    scheduler.schedule("ab", true);
    scheduler.schedule("abc", true);
    expect(values).toEqual(["a"]);
    release();
    await vi.runAllTimersAsync();
    expect(values).toEqual(["a", "abc"]);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("priority prefetch helpers", () => {
  it("enters priority mode within 2000px of the bottom", () => {
    expect(isNearListEnd({ scrollHeight: 10_000, scrollTop: 7_100, clientHeight: 1_000 })).toBe(true);
    expect(isNearListEnd({ scrollHeight: 10_000, scrollTop: 6_900, clientHeight: 1_000 })).toBe(false);
  });

  it("overrides the normal cap only while priority pages remain", () => {
    expect(canPrefetchPage({ cursor: "next", loading: false, priorityPages: 5, automaticPageCount: 12 })).toBe(true);
    expect(canPrefetchPage({ cursor: "next", loading: false, priorityPages: 0, automaticPageCount: 12 })).toBe(false);
    expect(canPrefetchPage({ cursor: "next", loading: false, priorityPages: 0, automaticPageCount: 9 })).toBe(true);
    expect(canPrefetchPage({ cursor: null, loading: false, priorityPages: 5, automaticPageCount: 12 })).toBe(false);
  });
});
