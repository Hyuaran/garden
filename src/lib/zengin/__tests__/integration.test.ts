import { describe, it, expect } from "vitest";
import { generateZenginCsv } from "../generator";
import { SAMPLE_SOURCE, SAMPLE_TRANSFERS } from "./fixtures/sample-transfers";

describe("integration: 3 件の振込を 3 銀行それぞれで生成", () => {
  it("楽天銀行向け CSV", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "rakuten",
    });
    expect(r.recordCount).toBe(3);
    expect(r.totalAmount).toBe(50000 + 75000 + 24980);
    expect(r.filename).toMatch(/\.csv$/);
    const headerDecoded = Buffer.from(r.content.subarray(0, 120)).toString("binary");
    expect(headerDecoded[0]).toBe("1");
  });

  it("みずほ銀行向け CSV（EOF マーク付き）", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "mizuho",
    });
    expect(r.filename).toMatch(/\.txt$/);
    expect(r.content[r.content.length - 1]).toBe(0x1a);
  });

  it("PayPay 銀行向け CSV", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "paypay",
    });
    expect(r.filename).toMatch(/\.csv$/);
  });

  it("合計 CRLF 込みのサイズが想定どおり", () => {
    const r = generateZenginCsv(SAMPLE_TRANSFERS, SAMPLE_SOURCE, {
      bank: "rakuten",
    });
    // 6 レコード（ヘッダ+データ×3+トレーラ+エンド）× 120 + CRLF × 6 = 732
    expect(r.content.length).toBe(6 * 120 + 6 * 2);
  });
});
