import { describe, expect, it } from "vitest";
import {
  EMERGENCY_CONTACT_CONSENT,
  jaWrap,
  renderEmergencyContactPdf,
  renderNdaPdf,
} from "./todoke-pdf.server";
import { todokeFilename } from "./todoke-drive.server";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
describe("emergency contact PDF", () => {
  it("renders a one-page Japanese PDF using the official consent text", async () => {
    const buffer = await renderEmergencyContactPdf({
      companyName: "株式会社ヒュアラン",
      representative: "後道翔太",
      kind: "new",
      employeeName: "社員A",
      selfAddress: "東京都",
      selfPhone: "090",
      ecName: "家族A",
      ecRelationship: "母",
      ecAddress: "同上",
      ecPhone: "080",
      submittedAt: new Date("2026-08-27T00:00:00Z"),
    });
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(buffer.length).toBeGreaterThan(5000);
    expect(EMERGENCY_CONTACT_CONSENT).toBe(
      "私は、入社にあたり、業務時間中の事故・災害、急病その他の緊急事態が発生した際の連絡先として、以下の通り届け出いたします。なお、本届出書に記載した個人情報が、上記の緊急連絡の目的に限り使用されることに同意いたします。また、緊急連絡先として指定した本人に対しても、貴社に連絡先を提出する旨の了解を得ております。",
    );
  });
  it("wraps Japanese without inserted hyphens and keeps the filing to one page", async () => {
    const buffer = await renderEmergencyContactPdf({
      companyName: "株式会社ヒュアラン",
      representative: "後道翔太",
      kind: "change",
      employeeName: "デモアカウント東海林美琴",
      selfAddress: "東京都渋谷区神宮前一丁目二番三号ガーデンビルディング十二階",
      selfPhone: "09012345678",
      ecName: "緊急連絡先テスト太郎",
      ecRelationship: "配偶者",
      ecAddress: "同上",
      ecPhone: "08012345678",
      submittedAt: new Date("2026-08-27T00:00:00Z"),
    });
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    expect(pdf.numPages).toBe(1);
    const content = await (await pdf.getPage(1)).getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("");
    expect(text).not.toContain("-");
    const normalized = text.replace(/[\s\u200B]/gu, "");
    expect(normalized).toContain("住所：");
    expect(normalized).not.toContain("本人と同一の場合");
  });
  it("wraps Japanese explicitly without splitting ASCII number runs", () => {
    expect(jaWrap("東京都渋谷区1-2-3", 6)).toBe("東京都渋谷区\n1-2-3");
    expect(jaWrap("090-1234-5678")).toBe("090-1234-5678");
  });
  it("uses the JST filing filename without the employee name", () => {
    expect(
      todokeFilename("緊急連絡先届", new Date("2026-08-26T15:01:02Z")),
    ).toBe("緊急連絡先届_20260827.pdf");
    expect(
      todokeFilename("緊急連絡先届", new Date("2026-08-26T15:01:02Z"), true),
    ).toBe("緊急連絡先届_20260827_000102.pdf");
  });
  it("renders the NDA as exactly two pages without inserted hyphens", async () => {
    const buffer = await renderNdaPdf({
      companyName: "株式会社ヒュアラン",
      representative: "後道翔太",
      kind: "new",
      employeeName: "社員A",
      pledgeDate: "2026-08-27",
      address: "東京都渋谷区神宮前一丁目二番三号",
    });
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    expect(pdf.numPages).toBe(2);
    let text = "";
    for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
      const content = await (await pdf.getPage(pageNo)).getTextContent();
      text += content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("");
    }
    expect(text).not.toContain("-");
    const normalized = text.replace(/[\s\u200B]/gu, "");
    expect(normalized).toContain("株式会社ヒュアラン");
    expect(normalized).toContain("代表取締役後道翔太様");
    expect(normalized).toContain("第6条損害賠償");
    expect(normalized).toContain(
      "以上の各条項を確認・理解した上で、本誓約書に署名いたします。",
    );
  });
});
