// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DRAFT_WATERMARK, generatePartnerTemplate, sanitizeContractText } from "./contract-template.server";
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
  it.each(["5,000 円", "¥ 12,000", "90 ％", "1,000円/件", "8,000 円／件", "90 %", "90％", "1.5 割", "500 円 ― ― ―", "５，０００　円", "5,000\n円", "¥\n12,000", "1.5\n割"])("masks money/rates despite PDF whitespace: %s", (value) => {
    const content = sanitizeContractText(`通知書\n単価 ${value}`, { title: "通知書", excludedTerms: [] });
    expect(content.paragraphs.join("")).toContain("＿＿＿＿");
    expect(content.paragraphs.join("")).not.toMatch(/[0-9０-９][0-9０-９,，.．]*[\s　]*(?:円|％|%|割)/g);
    expect(content.paragraphs.join("")).not.toMatch(/[¥￥]\s*\d/);
  });
  it("masks department, contact and document identifiers while retaining product names and 都市ガス", () => {
    const content = sanitizeContractText("通知書\n法人事業本部 第2事業部ネットワーク営業グループ\n担当：山田太郎\nTEL 06-1234-5678\n第2024-001号\n管理番号 0000019\nＭＸモバイリング株式会社\n関電ガス BIGLOBE光\n大阪ガスが供給する都市ガスを利用する顧客\n大阪府大阪市中央区1-2-3", { title: "通知書", excludedTerms: ["MXモバイリング株式会社"] });
    const text = content.paragraphs.join(" ");
    expect(text).not.toMatch(/法人事業本部|事業部|ネットワーク営業グループ|山田|06-1234|2024-001|0000019|モバイリング|大阪府大阪市/);
    expect(text).toContain("関電ガス BIGLOBE光");
    expect(text).toContain("大阪ガスが供給する都市ガスを利用する顧客");
  });
  it("separates addressee/title/greeting and moves 記 after 敬具", () => {
    const result = sanitizeContractText("元の相手先 御中\n発行部署\n関電ガス 通知書\n記\n拝啓 お知らせします。\nご確認ください。\n敬具\n１．対象\n関電ガス\n（１）単価\n5,000 円", { title: "関電ガス通知書", excludedTerms: [] });
    expect(result.blocks.slice(0, 4)).toEqual([
      { type: "text", text: "拝啓 お知らせします。ご確認ください。" }, { type: "text", text: "敬具" },
      { type: "text", text: "記" }, { type: "text", text: "１．対象" },
    ]);
    expect(result.paragraphs.join("")).not.toMatch(/元の相手先|発行部署/);
  });
  it("masks spaced representative names, prefecture-less addresses and electronic document IDs", () => {
    const result = sanitizeContractText("秘密保持契約書\n（乙）住 所：大阪市浪速区一丁目3番1号\n代表者：代表取締役 山田 太郎\n75839bdd38942b3e0c4ce85aad4db69f\n第１条 都市ガスの取次", { title: "秘密保持契約書", excludedTerms: [] });
    expect(result.paragraphs.join("")).not.toMatch(/大阪市|山田|太郎|75839/);
    expect(result.paragraphs.join("")).toContain("都市ガス");
  });
  it("masks title values too, and keeps years of obligation distinct from concrete dates", () => {
    const result = sanitizeContractText("2027年3月末日\n令和8年8月31日\n義務は5年間", { title: "5,000 円 通知書", excludedTerms: [] });
    expect(result.title).toBe("＿＿＿＿ 通知書");
    expect(result.paragraphs.join("")).not.toMatch(/2027|令和8|日月末日/);
    expect(result.paragraphs.join("")).toContain("5年間");
  });
  it("emits native Word tables and ruled PDF tables; masks after reconstructing numeric cells", async () => {
    const source = await PDFDocument.create(), page = source.addPage(), font = await source.embedFont(StandardFonts.Helvetica);
    for (const [r, value] of ["Price", "90 %", "500 %"].entries()) {
      page.drawText(r ? "BIGLOBE" : "Product", { x: 40, y: 700 - r * 25, size: 10, font });
      page.drawText(value, { x: 200, y: 700 - r * 25, size: 10, font });
    }
    const result = await generatePartnerTemplate(["fallback"], { issuer, title: "通知書", excludedTerms: [], sourcePdf: await source.save() });
    const word = await docxParts(result.docx), pdf = (await pdfPages(result.pdf)).join("");
    expect((word.xml.match(/<w:tbl>/g) ?? []).length).toBe(1);
    expect(word.xml).toContain('w:type="fixed"'); expect(word.xml).toContain("w:tblHeader");
    expect(word.xml).toContain('w:w="9638"'); expect(word.text).toContain("BIGLOBE");
    for (const text of [word.text, pdf]) expect(text.match(/[0-9０-９][0-9０-９,，.．]*[\s　]*(?:円|％|%|割)/g) ?? []).toEqual([]);
  });
  it("falls back to saved paragraphs for corrupt or image-only PDFs", async () => {
    const blank = await PDFDocument.create(); blank.addPage();
    for (const sourcePdf of [new Uint8Array([1, 2, 3]), await blank.save()]) {
      const result = await generatePartnerTemplate(["通知書\n拝啓 関電ガス 単価5,000 円\n敬具"], { issuer, title: "通知書", excludedTerms: [], sourcePdf });
      expect(result.content.blocks.every((b) => b.type === "text")).toBe(true);
      expect(result.content.paragraphs.join("")).toContain("関電ガス");
      expect(result.content.paragraphs.join("")).not.toContain("5,000");
    }
  });
  it("removes upstream identity, money, rates and concrete dates before layout", () => {
    const result = sanitizeContractText("販売条件通知書\nMXモバイリング株式会社\n対象期間 2026年8月7日から\n単価 5,000円 加入率90％\n第1条 条文は残る", { title: "販売条件通知書", excludedTerms: ["MXモバイリング株式会社"] });
    const text = result.paragraphs.join(" "); forbidden.forEach((value) => expect(text).not.toContain(value)); expect(text).toContain("第1条 条文は残る");
    expect(text).toContain("＿＿＿＿＿＿＿＿＿＿");
    expect(result.includeKi).toBe(false);
  });
  it("keeps fragmented article numbers and general year counts together, but removes page numbers", async () => {
    const result = await generatePartnerTemplate(["サービス取次代理店基本契約書\n第19条（反社会勢力と取引排除）\n解除後5年間は義務を負う。\n8"], { issuer, title: "サービス取次代理店基本契約書", excludedTerms: [] });
    const text = result.content.paragraphs.join(" ");
    expect(text).toContain("第19条（反社会勢力と取引排除）");
    expect(text).toContain("5年間");
    expect(result.content.paragraphs).not.toContain("8");
  });
  it("includes 記 only when it exists as a standalone source line", () => {
    expect(sanitizeContractText("通知書\n記\n第1項 内容", { title: "通知書", excludedTerms: [] }).includeKi).toBe(true);
    expect(sanitizeContractText("契約書\n第1条 内容", { title: "契約書", excludedTerms: [] }).includeKi).toBe(false);
  });
  it("creates editable Word and newly composed PDF without forbidden values", async () => {
    const lines = ["販売条件通知書", "MXモバイリング株式会社", "対象期間 2026年8月7日から", "単価 5,000円 加入率90％", ...Array.from({ length: 75 }, (_, index) => `第${index + 1}条 パートナーはサービスの取次条件を遵守するものとします。`)];
    const result = await generatePartnerTemplate([lines.join("\n")], { issuer, title: "販売条件通知書", excludedTerms: ["MXモバイリング株式会社"] });
    const word = await docxParts(result.docx), pages = await pdfPages(result.pdf), pdf = pages.join(" ");
    for (const value of forbidden) { expect(word.text).not.toContain(value); expect(pdf).not.toContain(value); }
    expect(word.text).toContain("株式会社ヒュアラン"); expect(pdf).toContain("株式会社ヒュアラン");
    expect(word.text).toContain("代表取締役"); expect(pdf).toContain("代表取締役"); expect(word.xml).toContain("DRAFT");
    expect(pages.length).toBeGreaterThan(1); pages.forEach((page) => expect(page).toContain("DRAFT"));
    expect(result.docx.subarray(0, 2).toString()).toBe("PK"); expect(result.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(DRAFT_WATERMARK).toEqual({ degrees: 45, opacity: 0.15, color: 0.65 });
  }, 20_000);
});
