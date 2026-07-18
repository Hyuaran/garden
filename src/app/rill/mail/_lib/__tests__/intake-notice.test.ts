import { describe, expect, it } from "vitest";
import { assertNoticeKind, limitNoticePages, noticeDriveNames, noticeProgressLabel, noticeStoragePath, noticeTemplate, noticeTemplateFields, reduceNoticeProgress, type NoticeProgress } from "../intake-notice";

describe("Rill Mail intake notice helpers", () => {
  it("builds the editable template with manual fields or empty labels", () => {
    expect(noticeTemplate(3, "東海林", "Garden案件")).toBe("FAX3枚到着のため、ご確認ください。\n営業担当：東海林\n案件名：Garden案件");
    expect(noticeTemplate(1)).toBe("FAX1枚到着のため、ご確認ください。\n営業担当：\n案件名：");
    expect(noticeTemplateFields(noticeTemplate(3, "東海林", "Garden案件"))).toEqual({ salesPerson: "東海林", projectName: "Garden案件" });
  });

  it("transitions conversion progress to reading and clears on complete or cancel", () => {
    let progress: NoticeProgress = null;
    progress = reduceNoticeProgress(progress, { type: "converting", done: 2, total: 3 });
    expect(progress && noticeProgressLabel(progress)).toBe("画像に変換中… 2/3枚");
    progress = reduceNoticeProgress(progress, { type: "reading" });
    expect(progress && noticeProgressLabel(progress)).toBe("内容を読み取り中…");
    expect(reduceNoticeProgress(progress, { type: "complete" })).toBeNull();
    expect(reduceNoticeProgress({ stage: "intake" }, { type: "cancel" })).toBeNull();
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
