import { describe, expect, it } from "vitest";
import { boxesForRequest, folderMessagePath, oneMessagePath, searchMessagePath, sentBox } from "../mail-boxes";
import type { RillMailBox } from "../types";

const own: RillMailBox = { id: "me", address: "me@example.com", label: "Me", kind: "personal" };
const shared: RillMailBox = { id: "team@example.com", address: "team@example.com", label: "Team", kind: "shared" };

describe("Rill Mail sent box routing", () => {
  it("adds a personal sent box without including it in the all-inboxes request", () => {
    expect(sentBox(own)).toMatchObject({ id: "sent", address: "me@example.com", label: "送信済み", kind: "personal" });
    expect(boxesForRequest([own, shared], "all")).toEqual([own, shared]);
    expect(boxesForRequest([own, shared], "sent")).toEqual([sentBox(own)]);
  });

  it("routes sent list, search, detail and attachments through the current user", () => {
    const sent = sentBox(own);
    expect(folderMessagePath(sent)).toBe("/me/mailFolders/sentitems/messages");
    expect(searchMessagePath(sent)).toBe("/me/mailFolders/sentitems/messages");
    expect(oneMessagePath("sent", "id/value")).toBe("/me/messages/id%2Fvalue");
  });
});
