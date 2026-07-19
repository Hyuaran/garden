import { afterEach, describe, expect, it, vi } from "vitest";
import { applyMoveExclusions, loadMoveExclusions, moveDestination, moveMessagePath, removeMovedMessages, restoreMovedMessages, saveMoveExclusions, scheduleMoveUndoWindow } from "../move-ops";
import type { RillMailMessage } from "../types";

const message = (id: string, date = "2026-07-19T01:00:00Z") => ({ id, box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" }, subject: "", fromName: "", fromAddress: "", to: [], receivedDateTime: date, hasAttachments: false, isRead: true, categories: [], bodyPreview: "" }) satisfies RillMailMessage;

describe("Rill Mail move operations", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves Archive, Deleted Items and Inbox destinations", () => {
    expect(moveDestination("archive")).toBe("archive");
    expect(moveDestination("delete")).toBe("deleteditems");
    expect(moveDestination("restore")).toBe("inbox");
    expect(moveMessagePath("me", "id/1")).toBe("/me/messages/id%2F1/move");
    expect(moveMessagePath("shared@example.com", "id/1")).toBe("/users/shared%40example.com/messages/id%2F1/move");
  });

  it("persists active exclusions by Garden user", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value), removeItem: (key: string) => void values.delete(key) };
    saveMoveExclusions(storage, "user-1", ["me:m1"], 1_000);
    expect([...loadMoveExclusions(storage, "user-1", 1_001).keys()]).toEqual(["me:m1"]);
    expect(loadMoveExclusions(storage, "user-2", 1_001).size).toBe(0);
  });

  it("optimistically excludes active moves and restores with the new Graph ID", () => {
    const first = message("old");
    const exclusions = new Map([["me:old", { expiresAt: 2_000 }]]);
    expect(applyMoveExclusions([first], exclusions, 1_000).messages).toEqual([]);
    expect(removeMovedMessages([first], new Set(["me:old"]))).toEqual([]);
    expect(restoreMovedMessages([], [{ ...first, id: "restored" }]).map((item) => item.id)).toEqual(["restored"]);
    expect(applyMoveExclusions([first], exclusions, 3_000).messages).toEqual([first]);
  });

  it("keeps undo available for five seconds and expires once", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const window = scheduleMoveUndoWindow(expired);
    vi.advanceTimersByTime(4_999); expect(expired).not.toHaveBeenCalled();
    expect(window.undo()).toBe(true);
    vi.advanceTimersByTime(1); expect(expired).not.toHaveBeenCalled();
    const second = scheduleMoveUndoWindow(expired);
    vi.advanceTimersByTime(5_000); expect(expired).toHaveBeenCalledTimes(1);
    expect(second.undo()).toBe(false);
  });
});
