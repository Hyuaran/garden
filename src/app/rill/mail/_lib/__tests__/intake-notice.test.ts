import { describe, expect, it } from "vitest";
import { assertNoticeKind, limitNoticePages, noticeDraftText, noticeDriveNames, noticeFallbackText, noticeStoragePath } from "../intake-notice";

describe("Rill Mail intake notice helpers", () => {
  it("combines the fixed template and summary, with a useful fallback", () => {
    expect(noticeDraftText("eFax", 3, "・期限は7月末です。\n・担当者へ提出してください。")).toContain("FAXが届きました。\n送信元：eFax\n3枚");
    expect(noticeDraftText("eFax", 3, "")).toBe(noticeFallbackText("eFax", 3));
  });

  it("caps valid PNG input at 20 pages and reports truncation", () => {
    const result = limitNoticePages(Array.from({ length: 21 }, () => ({ base64: "data:image/png;base64,AAAA" })));
    expect(result.pages).toHaveLength(20);
    expect(result.truncated).toBe(true);
    expect(limitNoticePages([{ base64: "not png" }]).pages).toHaveLength(0);
  });

  it("rejects API work for intake kinds other than 周知", () => {
    expect(() => assertNoticeKind("請求")).toThrow("Only 周知 intake is supported");
    expect(() => assertNoticeKind("周知")).not.toThrow();
  });

  it("builds Storage and Drive names with page suffixes", () => {
    expect(noticeStoragePath("123e4567-e89b-12d3-a456-426614174000", "2026-07-18T01:00:00Z", 2)).toBe("shuchi/2026/07/123e4567-e89b-12d3-a456-426614174000_p2.png");
    expect(noticeDriveNames("20260718_eFax_件名.pdf", 2)).toEqual({ pages: ["20260718_eFax_件名_p1.png", "20260718_eFax_件名_p2.png"], text: "20260718_eFax_件名_周知文.txt" });
  });
});
