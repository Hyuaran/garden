import { describe, expect, it } from "vitest";
import { abbreviateBox, daySeparatedMessages, formatMailDetailDate, formatMailListDate, isViewableAttachment, mailDayLabel, mergeMessagePages, mergeMessages, pruneToRefreshWindow, reviewerInitials, reviewerNames, reviewerTone, statusCategory } from "../format";
import type { RillMailMessage } from "../types";

const message = (id: string, receivedDateTime: string) => ({ id, receivedDateTime, box: { id: "me", address: "me@example.com", label: "自分", kind: "personal" }, subject: "", fromName: "", fromAddress: "", to: [], hasAttachments: false, isRead: false, categories: [], bodyPreview: "" }) satisfies RillMailMessage;

describe("Rill Mail formatters", () => {
  it("allows only PDF and supported image attachment MIME types", () => {
    ["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"].forEach((type) => expect(isViewableAttachment(type, "file.bin")).toBe(true));
    ["application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/octet-stream", "application/x-msdownload"].forEach((type) => expect(isViewableAttachment(type, "file.pdf")).toBe(false));
  });

  it("falls back to a case-insensitive extension only when MIME type is missing", () => {
    ["document.pdf", "photo.png", "photo.jpg", "photo.jpeg", "photo.gif", "photo.webp", "PHOTO.JPEG"].forEach((name) => expect(isViewableAttachment(undefined, name)).toBe(true));
    ["archive.zip", "sheet.xlsx", "document.docx", "program.exe", "unknown", ""].forEach((name) => expect(isViewableAttachment("", name)).toBe(false));
  });
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

  it("prunes disappeared messages only inside each refreshed first-page window", () => {
    const sharedBox = { ...message("x", "").box, id: "shared" };
    const current = [
      message("kept", "2026-07-18T03:00:00Z"),
      message("ghost", "2026-07-18T02:30:00Z"),
      message("older", "2026-07-17T00:00:00Z"),
      { ...message("missing-box", "2026-07-18T03:00:00Z"), box: sharedBox },
    ];
    const incoming = [message("kept", "2026-07-18T03:00:00Z"), message("window-edge", "2026-07-18T02:00:00Z")];
    expect(pruneToRefreshWindow(current, incoming, ["me"]).map((item) => item.id)).toEqual(["kept", "older", "missing-box"]);
    expect(pruneToRefreshWindow(current, [], ["me"]).map((item) => item.id)).toEqual(["missing-box"]);
  });

  it("assigns reviewer colors by stable employee order", () => {
    const reviewers = ["東海林美琴", "上田花子", "簡太郎", "金花子", "東海林二郎"];
    expect(reviewers.map((name) => reviewerTone(name, reviewers))).toEqual([0, 1, 2, 3, 0]);
  });

  it("sends invalid dates to the end without an empty day separator", () => {
    const values = mergeMessages([[message("invalid", "not-a-date"), message("valid", "2026-07-18T03:00:00Z")]]);
    expect(values.map((item) => item.id)).toEqual(["valid", "invalid"]);
    const separated = daySeparatedMessages(values, new Date("2026-07-18T04:00:00Z"));
    expect(separated[1]).toMatchObject({ label: "", showDay: false });
  });
});
