import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DRAFT_WATERMARK, generatePartnerTemplate, sanitizeContractText } from "./contract-template.server";
import { japanesePdf } from "./contract-test-pdf";
const issuer = { company_id: "COMP-001", company_name: "株式会社ヒュアラン", representative: "後道翔太", address: "大阪府大阪市中央区" };
const forbidden = ["MXモバイリング株式会社", "5,000円", "2026年8月7日", "90％"];
async function docxParts(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parts = await Promise.all(Object.keys(zip.files).filter((name) => /^word\/(?:document|header\d+)\.xml$/.test(name)).map((name) => zip.file(name)!.async("string")));
  const xml = parts.join(" ");
  return { xml, text: xml.replace(/<[^>]+>/g, "") };
}
async function pdfPages(buffer: Buffer) {
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  return Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const content = await (await pdf.getPage(index + 1)).getTextContent();
    return content.items.map((item) => ("str" in item ? item.str : "")).join("");
  }));
}
describe("template-based partner documents", () => {
  it("removes upstream identity, money, rates and concrete dates before layout", () => {
    const result = sanitizeContractText("販売条件通知書\nMXモバイリング株式会社\n対象期間 2026年8月7日から\n単価 5,000円 加入率90％\n第1条 条文は残る", { title: "販売条件通知書", excludedTerms: ["MXモバイリング株式会社"] });
    const text = result.paragraphs.join(" "); forbidden.forEach((value) => expect(text).not.toContain(value)); expect(text).toContain("第1条 条文は残る");
  });
  it("creates editable Word and newly composed PDF without forbidden values", async () => {
    const lines = ["販売条件通知書", "MXモバイリング株式会社", "対象期間 2026年8月7日から", "単価 5,000円 加入率90％", ...Array.from({ length: 75 }, (_, index) => `第${index + 1}条 パートナーはサービスの取次条件を遵守するものとします。`)];
    const result = await generatePartnerTemplate(await japanesePdf([lines.join("\n")], 1), { issuer, title: "販売条件通知書", excludedTerms: ["MXモバイリング株式会社"] });
    const word = await docxParts(result.docx), pages = await pdfPages(result.pdf), pdf = pages.join(" ");
    for (const value of forbidden) { expect(word.text).not.toContain(value); expect(pdf).not.toContain(value); }
    expect(word.text).toContain("株式会社ヒュアラン"); expect(pdf).toContain("株式会社ヒュアラン");
    expect(word.text).toContain("代表取締役"); expect(pdf).toContain("代表取締役"); expect(word.xml).toContain("DRAFT");
    expect(pages.length).toBeGreaterThan(1); pages.forEach((page) => expect(page).toContain("DRAFT"));
    expect(result.docx.subarray(0, 2).toString()).toBe("PK"); expect(result.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(DRAFT_WATERMARK).toEqual({ degrees: 45, opacity: 0.15, color: 0.65 });
  }, 20_000);
});
