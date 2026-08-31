// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { DRAFT_WATERMARK, draftWatermarkGeometry, generatePartnerTemplate, maskRepresentativeSignatures, sanitizeContractText } from "./contract-template.server";
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
  it("removes the six actual remaining leaks while retaining clauses and field labels in PDF/Word", async () => {
    const closing = "以上、本契約の成立を証するため、本契約書を2通作成し、甲乙記名押印の上各自1通を保有する。";
    const source = ["顧客紹介契約書", "第4条（支払方法）", "金融機関名：楽天銀行 支 店 名：第三営業支店", "口座種別：普通 当座 口 座 番 号：1234567", "口座名義：株式会社リンクサポート", "口座名義（カナ）：カ）リンクサポート", "第8条（解除）", "乙と競業関係にある会社の取締役（委員会設置会社における執行役等を含む）。", "第14条（契約変更）", "甲乙双方の代表者が記名捺印した書面により変更する。", "第16条（合意管轄裁判所）", `名古屋地方裁判所を合意管轄とする。${closing}締結日：令和7年3月18日甲：大阪市浪速区立葉一丁目3番1号`, "MaisonPartir303号", "株式会社リンクサポート", "代表取締役 山田 太郎", "乙：愛知県名古屋市瑞穂区雁道町1-16", "アメニティ雁道", "合同会社ジャストペイメント", "代表社員 山田 次郎"].join("\n");
    const result = await generatePartnerTemplate([source], { issuer, title: "顧客紹介契約書", excludedTerms: [] });
    const word = await docxParts(result.docx), pdf = (await pdfPages(result.pdf)).join("");
    for (const text of [word.text, pdf]) {
      for (const leak of ["楽天銀行", "第三営業支店", "カ）リンクサポート", "大阪市浪速区立葉一丁目3番1号", "MaisonPartir303", "アメニティ雁道", "1234567"]) expect(text).not.toContain(leak);
      for (const retained of ["名古屋地方裁判所", "競業関係にある会社の取締役", "甲乙双方の代表者が記名捺印した", "金融機関名", "支店名", "口座名義"]) expect(text).toContain(retained);
    }
    expect(result.content.paragraphs.slice(-5)).toEqual(["名古屋地方裁判所を合意管轄とする。", closing, "締結日：＿＿年＿＿月＿＿日", "甲：＿＿＿＿", "乙：＿＿＿＿"]);
  });
  it("keeps a physically wrapped closing statement together", () => {
    const result = sanitizeContractText("本文。\n以上、本契約の成立を証するため、\n本書2通を作成し、\n甲乙記名押印の上各自1通を保有する。\n締結日：2025年3月18日", { excludedTerms: [] });
    expect(result.paragraphs).toEqual(["本文。", "以上、本契約の成立を証するため、本書2通を作成し、甲乙記名押印の上各自1通を保有する。", "締結日：＿＿年＿＿月＿＿日"]);
  });
  it("also protects a court clause from the existing prefecture-address matcher", () => {
    const line = "甲及び乙は、大阪府大阪市の大阪地方裁判所を第一審の合意管轄裁判所とする。";
    expect(sanitizeContractText(line, { excludedTerms: [] }).paragraphs).toEqual([line]);
  });
  it.each([
    "（４） 代表取締役の変更",
    "⑬ 乙と競業関係にある会社の取締役（委員会設置会社における執行役等、これに準ずるものを含",
    "甲及び乙は、双方合意の上、甲乙双方の代表者が記名捺印した書面により本契約及びこれに付随する",
    "行為は、当該行為に対する乙の代表者の認識・過失の有無等にかかわらず、乙により行われ",
  ])("preserves the actual clause verbatim: %s", (line) => {
    expect(sanitizeContractText(line, { excludedTerms: [] }).paragraphs).toEqual([line]);
  });
  it.each([
    "株式会社ARATA　代表取締役　南野真央",
    "株式会社センターライズ　代表取締役　上田　菜桜",
  ])("still masks the actual company/representative signature: %s", (line) => {
    expect(sanitizeContractText(line, { excludedTerms: [] }).paragraphs).toEqual(["＿＿＿＿＿＿＿＿＿＿　＿＿＿＿"]);
  });
  it.each([
    "代表取締役 山田 太郎 印", "代表社員 やまだ たろう", "代表者 ヤマダ タロウ",
    "代表者名：代表取締役 南野 真央 印", "代表取締役社長 古江 恵治",
    "（甲）代表取締役 山田太郎（印）", "代表者 ＿＿＿＿ ＿＿＿＿", "代表者 ________",
  ])("masks only a complete signature field: %s", (line) => {
    expect(maskRepresentativeSignatures(line)).not.toBe(line);
    expect(maskRepresentativeSignatures(line)).not.toMatch(/代表取締役|代表社員|代表者 (?:ヤマダ|やまだ)/);
  });
  it.each([
    "取締役 山田 太郎", "乙の代表者 山田太郎", "代表者 山田 太郎 様",
    "代表取締役 山田 太郎 次郎", "代表者 山田太郎が", "代表者 山田 太郎 の変更",
    "代表取締役 山田太郎（委任）", "代表者 山田太郎、", "代表者 山田太郎。",
    "代表者 の変更", "代表者 が記名捺印", "代表取締役変更", "代表者 一二三四五六七八九十一",
    ...["の", "が", "は", "を", "に", "と"].map((particle) => `代表者 山田太郎${particle}同意`),
  ])("leaves ambiguous or narrative text intact: %s", (line) => {
    expect(maskRepresentativeSignatures(line)).toBe(line);
  });
  it("does not consume the next physical line or alter line endings", () => {
    const text = "代表取締役\r\n変更には合意を要する\r\n代表者 山田 太郎 印\r\n第1条 内容";
    expect(maskRepresentativeSignatures(text)).toBe("代表取締役\r\n変更には合意を要する\r\n＿＿＿＿ 印\r\n第1条 内容");
  });
  it("masks a two-column signature row only when both complete fields are signatures", () => {
    expect(maskRepresentativeSignatures("代表取締役 南野 真央 印 代表取締役 熊谷 浩治 印")).toBe("＿＿＿＿ 印 ＿＿＿＿ 印");
    for (const line of ["双方の代表者が記名捺印 代表取締役 熊谷 浩治 印", "代表取締役 南野 真央 印 代表者の変更"]) {
      expect(maskRepresentativeSignatures(line)).toBe(line);
    }
  });
  it.each([[595.28, 841.89], [612, 792], [841.89, 595.28]])("sizes/centers the watermark proportionally on %s x %s paper", async (width, height) => {
    const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const draft = draftWatermarkGeometry(width, height, font), angle = draft.degrees * Math.PI / 180;
    expect(font.widthOfTextAtSize("DRAFT", draft.size) / Math.hypot(width, height)).toBeCloseTo(0.8, 10);
    expect(draft.x + draft.textWidth / 2 * Math.cos(angle) - draft.textHeight / 2 * Math.sin(angle)).toBeCloseTo(width / 2, 8);
    expect(draft.y + draft.textWidth / 2 * Math.sin(angle) + draft.textHeight / 2 * Math.cos(angle)).toBeCloseTo(height / 2, 8);
    expect(draft.textWidth * Math.cos(angle) + draft.textHeight * Math.sin(angle)).toBeLessThan(width);
    expect(draft.textWidth * Math.sin(angle) + draft.textHeight * Math.cos(angle)).toBeLessThan(height);
  });
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
    expect(DRAFT_WATERMARK).toEqual({ diagonalRatio: 0.8, opacity: 0.15, color: 0.65 });
    const [shapeWidth, shapeHeight, rotation] = word.xml.match(/width:([\d.]+)pt;height:([\d.]+)pt;rotation:([\d.]+)/)!.slice(1).map(Number);
    const metrics = await PDFDocument.create(), font = await metrics.embedFont(StandardFonts.HelveticaBold);
    const wordDraft = draftWatermarkGeometry(11906 / 20, 16838 / 20, font);
    expect(shapeWidth).toBeCloseTo(wordDraft.textWidth, 8);
    expect(shapeHeight).toBeCloseTo(wordDraft.textHeight, 8);
    expect(rotation).toBeCloseTo(360 - wordDraft.degrees, 8);
    expect(word.xml).toContain("mso-position-horizontal-relative:page");
    expect(word.xml).toContain("mso-position-vertical-relative:page");
    expect(word.xml).toContain('fillcolor="#d9d9d9"');
    const headerTag = word.xml.match(/<w:hdr\b[^>]*>/)![0];
    expect(headerTag.match(/xmlns:v=/g)).toHaveLength(1);
    expect(headerTag.match(/xmlns:o=/g)).toHaveLength(1);
    const rendered = await getDocument({ data: new Uint8Array(result.pdf) }).promise;
    try {
      for (let n = 1; n <= rendered.numPages; n++) {
        const page = await rendered.getPage(n), content = await page.getTextContent();
        const draft = content.items.find((item) => "str" in item && item.str === "DRAFT");
        expect(draft && "width" in draft ? draft.width / Math.hypot(page.view[2], page.view[3]) : 0).toBeCloseTo(0.8, 5);
      }
    } finally { await rendered.destroy(); }
  }, 20_000);
});
