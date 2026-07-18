import { describe, expect, it } from "vitest";
import { assertOwnConfirmationName, isMessageUnread, isPersonalMailbox, replaceMailState, selectionRange, toggleOwnConfirmation } from "../write-ops";
import type { RillMailMessage } from "../types";

const baseMessage: RillMailMessage = {
  id: "m1", box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" },
  subject: "", fromName: "", fromAddress: "", to: [], receivedDateTime: "", hasAttachments: false,
  isRead: false, flag: {}, categories: [], bodyPreview: "",
};

describe("Rill Mail write rules", () => {
  it("replaces the one state while preserving confirmations and unrelated categories", () => {
    expect(replaceMailState(["要対応", "東海林美琴", "取引先"], "処理済")).toEqual(["東海林美琴", "取引先", "処理済"]);
    expect(replaceMailState(["確認中", "東海林美琴"], null)).toEqual(["東海林美琴"]);
  });

  it("only permits the authenticated user's confirmation name", () => {
    expect(() => assertOwnConfirmationName("上田花子", "東海林美琴")).toThrow("他の利用者");
    expect(() => assertOwnConfirmationName("東海林美琴", "東海林美琴")).not.toThrow();
    expect(toggleOwnConfirmation(["上田花子"], "東海林美琴", true)).toEqual(["上田花子", "東海林美琴"]);
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
});
