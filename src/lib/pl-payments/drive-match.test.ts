import { describe, expect, it } from "vitest";

import { matchInvoiceFiles, normalizeForMatch } from "./drive-match";

const file = (id: string, name: string) => ({
  id,
  name,
  mimeType: "application/pdf",
  webViewLink: null,
  modifiedTime: null,
});

describe("drive invoice match", () => {
  it("normalizes full-width, case, and spaces", () => {
    expect(normalizeForMatch("ＡＢ C　１２")).toBe("abc12");
  });

  it("matches supported month patterns", () => {
    for (const name of ["エンジンポット_2026.08.pdf", "エンジンポット_202608.pdf", "エンジンポット_2026年08月.pdf"]) {
      const result = matchInvoiceFiles([file("f1", name)], "エンジンポット", "2026-08");
      expect(result.status).toBe("matched");
    }
  });

  it("reports none and multiple candidates", () => {
    expect(matchInvoiceFiles([], "エンジンポット", "2026-08").status).toBe("none");
    expect(
      matchInvoiceFiles([file("f1", "エンジンポット_202608.pdf"), file("f2", "エンジンポット_2026年08月.pdf")], "エンジンポット", "2026-08").status,
    ).toBe("multiple");
  });
});
