import { describe, expect, it } from "vitest";
import { applyLocalMailMutation, assertConfirmationAddition, assertOwnConfirmationName, detailCacheKey, filterOwnPinned, hasOwnPin, isMessageUnread, isPersonalMailbox, messagesForBox, pinCategoryName, replaceMailState, selectLegacyFlagImportTargets, selectionRange, stateSetterName, toggleOwnConfirmation, toggleOwnPin, withCachedDetail } from "../write-ops";
import type { RillMailDetail, RillMailMessage } from "../types";

const baseMessage: RillMailMessage = {
  id: "m1", box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" },
  subject: "", fromName: "", fromAddress: "", to: [], receivedDateTime: "", hasAttachments: false,
  isRead: false, categories: [], bodyPreview: "",
};

describe("Rill Mail write rules", () => {
  it("replaces the one state while preserving confirmations and unrelated categories", () => {
    expect(replaceMailState(["要対応", "状態設定:上田花子", "東海林美琴", "取引先"], "処理済", "東海林美琴")).toEqual(["東海林美琴", "取引先", "処理済", "状態設定:東海林美琴"]);
    expect(replaceMailState(["確認中", "状態設定:東海林美琴", "東海林美琴"], null, "東海林美琴")).toEqual(["東海林美琴"]);
    expect(stateSetterName(["処理済", "状態設定:東海林美琴"])).toBe("東海林美琴");
  });

  it("only permits the authenticated user's confirmation name", () => {
    expect(() => assertOwnConfirmationName("上田花子", "東海林美琴")).toThrow("他の利用者");
    expect(() => assertOwnConfirmationName("東海林美琴", "東海林美琴")).not.toThrow();
    expect(toggleOwnConfirmation(["上田花子"], "東海林美琴", true)).toEqual(["上田花子", "東海林美琴"]);
    expect(() => assertConfirmationAddition(false)).toThrow("取り消せません");
    expect(() => toggleOwnConfirmation(["東海林美琴"], "東海林美琴", false)).toThrow("取り消せません");
  });

  it("allows isRead only for the /me personal mailbox and uses confirmation for shared unread", () => {
    expect(isPersonalMailbox(baseMessage.box)).toBe(true);
    const shared = { ...baseMessage, box: { id: "keiri@example.com", address: "keiri@example.com", label: "経理", kind: "shared" as const }, isRead: true };
    expect(isPersonalMailbox(shared.box)).toBe(false);
    expect(isMessageUnread(shared, "東海林美琴")).toBe(true);
    expect(isMessageUnread({ ...shared, categories: ["東海林美琴"] }, "東海林美琴")).toBe(false);
  });

  it("calculates an inclusive Shift selection in either direction", () => {
    expect(selectionRange(["a", "b", "c", "d"], "b", "d")).toEqual(["b", "c", "d"]);
    expect(selectionRange(["a", "b", "c", "d"], "d", "b")).toEqual(["b", "c", "d"]);
  });

  it("applies immediate local mutations without changing unrelated fields", () => {
    expect(applyLocalMailMutation(baseMessage, "pin", true, "東海林美琴").categories).toEqual(["ピン:東海林美琴"]);
    expect(applyLocalMailMutation({ ...baseMessage, categories: ["東海林美琴", "確認中"] }, "state", "処理済", "東海林美琴").categories).toEqual(["東海林美琴", "処理済", "状態設定:東海林美琴"]);
    expect(applyLocalMailMutation(baseMessage, "confirm", true, "東海林美琴").categories).toEqual(["東海林美琴"]);
  });

  it("names and toggles only the authenticated user's pin category", () => {
    expect(pinCategoryName("東海林美琴")).toBe("ピン:東海林美琴");
    const categories = ["要対応", "ピン:上田花子", "取引先"];
    expect(toggleOwnPin(categories, "東海林美琴", true)).toEqual([...categories, "ピン:東海林美琴"]);
    expect(toggleOwnPin([...categories, "ピン:東海林美琴"], "東海林美琴", false)).toEqual(categories);
  });

  it("displays and filters by the authenticated user's pin only", () => {
    const mine = { ...baseMessage, id: "mine", categories: ["ピン:東海林美琴"] };
    const theirs = { ...baseMessage, id: "theirs", categories: ["ピン:上田花子"] };
    expect(hasOwnPin(mine.categories, "東海林美琴")).toBe(true);
    expect(hasOwnPin(theirs.categories, "東海林美琴")).toBe(false);
    expect(filterOwnPinned([mine, theirs], "東海林美琴").map((message) => message.id)).toEqual(["mine"]);
  });

  it("imports only flagged messages that do not already have the user's pin", () => {
    const messages = [
      { id: "new", flag: { flagStatus: "flagged" }, categories: ["ピン:上田花子"] },
      { id: "duplicate", flag: { flagStatus: "flagged" }, categories: ["ピン:東海林美琴"] },
      { id: "plain", flag: { flagStatus: "notFlagged" }, categories: [] },
    ];
    expect(selectLegacyFlagImportTargets(messages, "東海林美琴").map((message) => message.id)).toEqual(["new"]);
  });

  it("switches boxes immediately from the messages already in memory", () => {
    const personal = { ...baseMessage, id: "personal" };
    const shared = { ...baseMessage, id: "shared", box: { id: "keiri@example.com", address: "keiri@example.com", label: "経理", kind: "shared" as const } };
    const pinned = { ...shared, id: "pinned", categories: ["ピン:東海林美琴"] };
    expect(messagesForBox([personal, shared, pinned], "all", "東海林美琴").map((message) => message.id)).toEqual(["personal", "shared", "pinned"]);
    expect(messagesForBox([personal, shared, pinned], "me", "東海林美琴").map((message) => message.id)).toEqual(["personal"]);
    expect(messagesForBox([personal, shared, pinned], "keiri@example.com", "東海林美琴").map((message) => message.id)).toEqual(["shared", "pinned"]);
    expect(messagesForBox([personal, shared, pinned], "flagged", "東海林美琴").map((message) => message.id)).toEqual(["pinned"]);
  });

  it("keys detail cache by box and id and replaces stale detail", () => {
    const first = { ...baseMessage, cc: [], bcc: [], body: { contentType: "text" as const, content: "old" }, attachments: [] } satisfies RillMailDetail;
    const refreshed = { ...first, body: { contentType: "text" as const, content: "new" } };
    const firstCache = withCachedDetail(new Map(), first);
    const refreshedCache = withCachedDetail(firstCache, refreshed);
    expect(detailCacheKey(first)).toBe("me:m1");
    expect(refreshedCache.get("me:m1")?.body.content).toBe("new");
    expect(firstCache.get("me:m1")?.body.content).toBe("old");
  });
});
