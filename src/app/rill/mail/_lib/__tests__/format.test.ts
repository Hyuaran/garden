import { describe, expect, it } from "vitest";
import { abbreviateBox, daySeparatedMessages, formatMailDetailDate, formatMailListDate, mailDayLabel, mergeBoxCursors, mergeMessagePages, mergeMessages, reviewerInitials, reviewerNames, statusCategory } from "../format";
import type { RillMailMessage } from "../types";

const message = (id: string, receivedDateTime: string) => ({ id, receivedDateTime, box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" }, subject: "", fromName: "", fromAddress: "", to: [], hasAttachments: false, isRead: false, flag: {}, categories: [], bodyPreview: "" }) satisfies RillMailMessage;

describe("Rill Mail formatters", () => {
  it("formats list and detail dates in Tokyo time", () => {
    expect(formatMailListDate("2026-07-17T08:42:00Z")).toBe("26/07/17(金) 17:42");
    expect(formatMailDetailDate("2026-07-17T08:42:00Z")).toBe("2026/07/17(金) 17:42");
  });
  it("merges newest first", () => expect(mergeMessages([[message("a", "2026-01-01T00:00:00Z")], [message("b", "2026-02-01T00:00:00Z")]]).map((item) => item.id)).toEqual(["b", "a"]));
  it("abbreviates badges and extracts known reviewer initials", () => {
    expect(abbreviateBox("KEIRI@hyualan.co.jp")).toBe("keiri");
    expect(abbreviateBox("kanri_honbu_all@hyualan.co.jp")).toBe("kanri_honbu_all");
    expect(reviewerInitials(["要対応", "東海林美琴", "上田花子"], ["東海林美琴", "上田花子"])).toEqual(["東", "上"]);
  });

  it("merges nextLink pages from multiple boxes without duplicates", () => {
    const current = [message("same", "2026-07-18T02:00:00Z"), { ...message("old", "2026-07-17T02:00:00Z"), box: { ...message("old", "").box, id: "shared" } }];
    const incoming = [{ ...message("same", "2026-07-18T03:00:00Z"), subject: "updated" }, { ...message("next", "2026-07-16T02:00:00Z"), box: { ...message("next", "").box, id: "shared" } }];
    expect(mergeMessagePages(current, incoming).map((item) => `${item.box.id}:${item.id}`)).toEqual(["me:same", "shared:old", "shared:next"]);
    expect(mergeMessagePages(current, incoming)[0].subject).toBe("updated");
    expect(mergeBoxCursors({ me: "next-me", shared: "next-shared" }, { me: null })).toEqual({ me: null, shared: "next-shared" });
  });

  it("inserts Today, Yesterday and dated bands across a month boundary", () => {
    const now = new Date("2026-08-01T03:00:00Z");
    expect(mailDayLabel("2026-08-01T01:00:00Z", now)).toBe("今日");
    expect(mailDayLabel("2026-07-31T01:00:00Z", now)).toBe("昨日");
    expect(mailDayLabel("2026-07-30T01:00:00Z", now)).toBe("07/30(木)");
    const separated = daySeparatedMessages([message("a", "2026-08-01T01:00:00Z"), message("b", "2026-08-01T00:00:00Z"), message("c", "2026-07-31T01:00:00Z")], now);
    expect(separated.map(({ label, showDay }) => [label, showDay])).toEqual([["今日", true], ["今日", false], ["昨日", true]]);
  });

  it("detects the state and reviewer names for the second and third rows", () => {
    const categories = ["確認中", "東海林美琴", "取引先"];
    expect(statusCategory(categories)).toBe("確認中");
    expect(reviewerNames(categories, ["東海林美琴", "上田花子"])).toEqual(["東海林美琴"]);
  });
});
