import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  DRAFT_WATERMARK,
  findMaskTargets,
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
  const item = (str: string) => ({
    str,
    transform: [1, 0, 0, 1, 0, 0],
    width: str.length * 10,
    height: 10,
  });
  it("masks only the matched range when money spans text items", () => {
    expect(
      findMaskTargets(
        ["株式会社", "ARATAに対し、金", "42万", "円（税込み）を"].map(item),
        [],
        true,
      ),
    ).toEqual([
      { item: 2, start: 0, length: 3 },
      { item: 3, start: 0, length: 1 },
    ]);
  });
  it("maps whitespace-free positions back to the original item", () => {
    expect(
      findMaskTargets(
        ["前文　株式会社", "　ＩＭＧ　（以下、乙）"].map(item),
        ["株式会社ＩＭＧ"],
        false,
      ),
    ).toEqual([
      { item: 0, start: 3, length: 4 },
      { item: 1, start: 1, length: 3 },
    ]);
  });
  it("masks a phrase within one item without widening the range", () => {
    expect(
      findMaskTargets([item("前株式会社ＩＭＧ後")], ["株式会社ＩＭＧ"], false),
    ).toEqual([{ item: 0, start: 1, length: 7 }]);
  });
  it("masks every occurrence of the same phrase", () => {
    expect(
      findMaskTargets(
        [item("株式会社ＩＭＧと株式会社ＩＭＧ")],
        ["株式会社ＩＭＧ"],
        false,
      ),
    ).toEqual([
      { item: 0, start: 0, length: 7 },
      { item: 0, start: 8, length: 7 },
    ]);
  });
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
