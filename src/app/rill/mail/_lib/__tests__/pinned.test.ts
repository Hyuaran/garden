import { describe, expect, it } from "vitest";
import { mergePinnedMessages, pinnedCategoryFilter, pinnedPagingDecision, reconcilePinnedMessage } from "../pinned";
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
});
