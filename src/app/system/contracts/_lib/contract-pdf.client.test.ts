import { describe, expect, it } from "vitest";
import { joinPdfTextItems } from "./contract-pdf.client";
describe("browser contract PDF extraction", () => {
  it("keeps PDF text items on their physical lines", () => {
    expect(joinPdfTextItems([
      { str: "第" }, { str: "19" }, { str: "条", hasEOL: true },
      { str: "5" }, { str: "年", hasEOL: true },
    ])).toBe("第19条\n5年");
  });
});
