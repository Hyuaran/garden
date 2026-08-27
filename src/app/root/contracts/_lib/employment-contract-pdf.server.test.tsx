import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { renderEmploymentContractPdf } from "./employment-contract-pdf.server";
const data = {
  companyName: "株式会社ヒュアラン",
  representative: "後道翔太",
  companyAddress: "〒530-0001 大阪府大阪市北区梅田一丁目",
  employeeName: "社員A",
  kind: "new" as const,
  contractStart: "2026-09-01",
  contractEnd: "2027-03-31",
  jobType: "sales" as const,
  jobTypeOther: "",
  hourlyWage: 1200,
  workLocation: "大阪府大阪市（または甲が指定する場所）",
  concludedOn: "2026-08-28",
  employeeAddress: "",
};
describe("employment contract PDF", () => {
  it("renders exactly three pages without automatic hyphens", async () => {
    const buffer = await renderEmploymentContractPdf(data);
    expect(buffer.subarray(0, 4).toString()).toBe("%PDF");
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    expect(pdf.numPages).toBe(3);
    let text = "";
    for (let n = 1; n <= 3; n++) {
      const c = await (await pdf.getPage(n)).getTextContent();
      text += c.items.map((i) => ("str" in i ? i.str : "")).join("");
    }
    expect(text).not.toMatch(
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]-[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
    );
    const normalized = text.replace(/[\s\u200B]/gu, "");
    expect(normalized).toContain("株式会社ヒュアラン");
    expect(normalized).toContain("代表取締役後道翔太㊞");
    expect(normalized).toContain("✓新規");
    expect(normalized).toContain("✓営業職");
    expect(normalized).toContain("時給［1,200］円");
    expect(normalized).toContain("以下、余白とする。");
    expect(normalized).not.toContain("住所：大阪");
  });
  it("changes company insertion", async () => {
    const buffer = await renderEmploymentContractPdf({
      ...data,
      companyName: "株式会社ブルーム",
      representative: "代表者C",
      companyAddress: "〒100-0001 東京都千代田区",
    });
    const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
    const c = await (await pdf.getPage(1)).getTextContent();
    const text = c.items
      .map((i) => ("str" in i ? i.str : ""))
      .join("")
      .replace(/\s/g, "");
    expect(text).toContain("株式会社ブルーム");
    expect(text).toContain("代表取締役代表者C㊞");
  });
});
