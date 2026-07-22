import { describe, expect, it } from "vitest";
import { applyPinOverrides, applyRecentCategoryWrites, loadPinOverrides, mergePinnedMessages, PIN_OVERRIDE_TTL_MS, pinnedCategoryFilter, pinnedPagingDecision, reconcilePinnedMessage, removePinOverride, savePinOverride, shouldAddBulkPin, sortPinnedMessages, toggleVisibleSelection } from "../pinned";
import type { RillMailBox, RillMailMessage } from "../types";

const me: RillMailBox = { id: "me", address: "me@example.com", label: "Me", kind: "personal" };
const team: RillMailBox = { id: "team", address: "team@example.com", label: "Team", kind: "shared" };
const message = (id: string, box = me, date = "2026-01-01T00:00:00Z", categories = ["ピン:O'Neil"]): RillMailMessage => ({
  id, box, subject: id, fromName: "A", fromAddress: "a@example.com", to: [], receivedDateTime: date,
  hasAttachments: false, isRead: false, categories, bodyPreview: "",
});

describe("pinned Graph helpers", () => {
  it("escapes apostrophes in the OData category filter", () => {
    expect(pinnedCategoryFilter("O'Neil")).toBe("categories/any(c: c eq 'ピン:O''Neil')");
  });

  it("saves, reloads, and removes expired per-user overrides", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    savePinOverride(storage, "user-1", "me:1", false, 1_000);
    expect(loadPinOverrides(storage, "user-1", 2_000).get("me:1")?.ownPinned).toBe(false);
    expect(loadPinOverrides(storage, "user-1", 1_000 + PIN_OVERRIDE_TTL_MS).size).toBe(0);
    savePinOverride(storage, "user-1", "me:1", true, 3_000);
    expect(removePinOverride(storage, "user-1", "me:1", 3_001).size).toBe(0);
  });

  it("applies pin removal or addition while preserving every other category", () => {
    const pinned = message("1", me, "2026-01-01T00:00:00Z", ["確認中", "ピン:O'Neil", "別の人"]);
    const removed = applyPinOverrides([pinned], new Map([["me:1", { ownPinned: false, expiresAt: 10_000 }]]), "O'Neil")[0];
    expect(removed.categories).toEqual(["確認中", "別の人"]);
    const added = applyPinOverrides([{ ...pinned, categories: ["確認中"] }], new Map([["me:1", { ownPinned: true, expiresAt: 10_000 }]]), "O'Neil")[0];
    expect(added.categories).toEqual(["確認中", "ピン:O'Neil"]);
  });

  it("excludes persisted removals from the pinned view but lets memory write-wins take priority", () => {
    const pinned = message("1");
    const overrides = new Map([["me:1", { ownPinned: false, expiresAt: 10_000 }]]);
    expect(applyPinOverrides([pinned], overrides, "O'Neil", { pinnedView: true })).toEqual([]);
    expect(applyPinOverrides([pinned], overrides, "O'Neil", { pinnedView: true, protectedKeys: new Set(["me:1"]) })).toEqual([pinned]);
  });

  it("stops and reports truncation only when a next page remains at the limit", () => {
    expect(pinnedPagingDecision(499, true)).toEqual({ stop: false, truncated: false });
    expect(pinnedPagingDecision(500, true)).toEqual({ stop: true, truncated: true });
    expect(pinnedPagingDecision(500, false)).toEqual({ stop: true, truncated: false });
  });

  it("merges newest first and deduplicates by box and id", () => {
    const result = mergePinnedMessages([[message("same", me, "2026-01-01T00:00:00Z"), message("old", team, "2025-01-01T00:00:00Z")], [message("same", me, "2026-01-01T00:00:00Z"), message("same", team, "2027-01-01T00:00:00Z")]]);
    expect(result.map((item) => `${item.box.id}:${item.id}`)).toEqual(["team:same", "me:same", "team:old"]);
  });

  it("removes a message immediately when its own pin is cleared", () => {
    const pinned = message("1");
    expect(reconcilePinnedMessage([pinned], { ...pinned, categories: [] }, "O'Neil")).toEqual([]);
  });

  it("prefers recent categories and removes an unpinned item from the pinned view", () => {
    const pinned = message("1");
    const writes = new Map([["me:1", { categories: ["処理済"], expiresAt: 61_000 }]]);
    expect(applyRecentCategoryWrites([pinned], writes, 1_000).messages[0].categories).toEqual(["処理済"]);
    expect(applyRecentCategoryWrites([pinned], writes, 1_000, { pinnedView: true, ownName: "O'Neil" }).messages).toEqual([]);
  });

  it("keeps an optimistic search-result confirmation and state setter over a stale response", () => {
    const stale = message("search", me, "2026-01-01T00:00:00Z", []);
    const categories = ["東海林美琴", "要対応", "状態設定:東海林美琴"];
    const result = applyRecentCategoryWrites([stale], new Map([["me:search", { categories, expiresAt: 61_000 }]]), 1_000);
    expect(result.messages[0].categories).toEqual(categories);
  });

  it("drops expired writes and lets server categories pass through", () => {
    const pinned = message("1");
    const result = applyRecentCategoryWrites([pinned], new Map([["me:1", { categories: [], expiresAt: 1_000 }]]), 1_000);
    expect(result.messages[0].categories).toEqual(["ピン:O'Neil"]);
    expect(result.writes.size).toBe(0);
  });

  it("toggles bulk pin off only when every selected item is already pinned", () => {
    const pinned = message("1");
    const plain = message("2", me, "2026-01-01T00:00:00Z", []);
    expect(shouldAddBulkPin([pinned], "O'Neil")).toBe(false);
    expect(shouldAddBulkPin([pinned, plain], "O'Neil")).toBe(true);
    expect(shouldAddBulkPin([plain], "O'Neil")).toBe(true);
  });

  it("sorts pins by received time in both directions and keeps equal times stable", () => {
    const same = "2026-01-02T00:00:00Z";
    const input = [message("same-a", me, same), message("old", me, "2026-01-01T00:00:00Z"), message("same-b", me, same)];
    expect(sortPinnedMessages(input, "newest").map((item) => item.id)).toEqual(["same-a", "same-b", "old"]);
    expect(sortPinnedMessages(input, "oldest").map((item) => item.id)).toEqual(["old", "same-a", "same-b"]);
    expect(input.map((item) => item.id)).toEqual(["same-a", "old", "same-b"]);
  });

  it("selects only visible filtered keys and clears them in one operation", () => {
    const visible = Array.from({ length: 159 }, (_, index) => `me:${index}`);
    const selected = toggleVisibleSelection(new Set(["me:hidden"]), visible);
    expect(selected.size).toBe(159);
    expect(selected.has("me:hidden")).toBe(false);
    expect(toggleVisibleSelection(selected, visible).size).toBe(0);
    expect(toggleVisibleSelection(new Set(), ["me:filtered"])).toEqual(new Set(["me:filtered"]));
  });
});
