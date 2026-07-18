import { describe, expect, it } from "vitest";
import { abbreviateBox, formatMailDetailDate, formatMailListDate, mergeMessages, reviewerInitials } from "../format";
import type { RillMailMessage } from "../types";

const message = (id: string, receivedDateTime: string) => ({ id, receivedDateTime, box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" }, subject: "", fromName: "", fromAddress: "", to: [], hasAttachments: false, isRead: false, flag: {}, categories: [], bodyPreview: "" }) satisfies RillMailMessage;

describe("Rill Mail formatters", () => {
  it("formats list and detail dates in Tokyo time", () => {
    expect(formatMailListDate("2026-07-17T08:42:00Z")).toBe("26/07/17(金) 17:42");
    expect(formatMailDetailDate("2026-07-17T08:42:00Z")).toBe("2026/07/17(金) 17:42");
  });
  it("merges newest first", () => expect(mergeMessages([[message("a", "2026-01-01T00:00:00Z")], [message("b", "2026-02-01T00:00:00Z")]]).map((item) => item.id)).toEqual(["b", "a"]));
  it("abbreviates badges and extracts known reviewer initials", () => {
    expect(abbreviateBox("経理共有メールボックス")).toBe("経理");
    expect(reviewerInitials(["要対応", "東海林美琴", "上田花子"], ["東海林美琴", "上田花子"])).toEqual(["東", "上"]);
  });
});
