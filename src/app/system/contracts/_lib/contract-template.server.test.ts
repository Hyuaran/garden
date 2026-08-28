import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  DRAFT_WATERMARK,
  findMoneyExpressions,
  generatePartnerTemplate,
} from "./contract-template.server";
import { japanesePdf, latinPdf } from "./contract-test-pdf";
const issuer = {
  company_id: "COMP-001",
  company_name: "株式会社ヒュアラン",
  representative: "後道翔太",
  address: "大阪府大阪市",
};
describe("partner template", () => {
  it("detects currency but not article numbers", () => {
    expect(
      findMoneyExpressions("単価は1,200円、別料金は¥ 3000。第3条"),
    ).toEqual(["1,200円", "¥ 3000"]);
  });
  it("masks terms and money, adds issuer and watermark to every page", async () => {
    const source = await latinPdf([
        "A Corp price ¥ 1,200 Article 3",
        "page two",
      ]),
      result = await generatePartnerTemplate(source, {
        hiddenTerms: ["A Corp"],
        maskMoney: true,
        issuer,
      });
    expect(result).toMatchObject({ scanned: false });
    expect(result.maskedCount).toBeGreaterThanOrEqual(2);
    const pdf = await getDocument({ data: new Uint8Array(result.buffer) })
      .promise;
    expect(pdf.numPages).toBe(2);
    for (let n = 1; n <= 2; n++) {
      const c = await (await pdf.getPage(n)).getTextContent(),
        text = c.items.map((i) => ("str" in i ? i.str : "")).join("");
      expect(text).toContain("DRAFT");
      if (n === 1) {
        expect(text.replace(/\s/g, "")).toContain("株式会社ヒュアラン");
        expect(text.replace(/\s/g, "")).toContain("代表取締役後道翔太");
      }
    }
    expect(DRAFT_WATERMARK).toEqual({
      degrees: 45,
      opacity: 0.15,
      color: 0.65,
    });
  });
  it("flags image-only PDFs but still generates", async () => {
    const result = await generatePartnerTemplate(await japanesePdf([], 1), {
      hiddenTerms: ["A社"],
      maskMoney: true,
      issuer,
    });
    expect(result.scanned).toBe(true);
    expect(result.buffer.subarray(0, 4).toString()).toBe("%PDF");
  });
});
