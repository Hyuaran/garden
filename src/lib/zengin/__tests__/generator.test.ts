import { describe, it, expect } from "vitest";
import { generateZenginCsv } from "../generator";
import type {
  ZenginSourceAccount,
  ZenginTransferInput,
} from "../types";

const source: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁ",
  source_account_type: "1",
  source_account_number: "7853952",
};

const transfers: ZenginTransferInput[] = [
  {
    payee_bank_code: "0001",
    payee_branch_code: "100",
    payee_account_type: "1",
    payee_account_number: "1234567",
    payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
    amount: 50000,
  },
  {
    payee_bank_code: "0005",
    payee_branch_code: "200",
    payee_account_type: "1",
    payee_account_number: "2345678",
    payee_account_holder_kana: "ｽｽﾞｷ ﾊﾅｺ",
    amount: 75000,
  },
];

describe("generateZenginCsv", () => {
  it("4 レコード（ヘッダ+データ×2+トレーラ+エンド）で計 600 byte + CRLF × 4", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    // 120 * 5 レコード = 600, 行末 CRLF(2) × 5 行 = 10, 楽天は EOF なしで末尾改行のみ
    expect(result.content.length).toBe(600 + 5 * 2);
  });

  it("ファイル名が推奨形式 zengin_YYYYMMDD_<銀行>.csv", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    expect(result.filename).toMatch(/^zengin_\d{8}_rakuten\.csv$/);
  });

  it("合計件数と合計金額が正しい", () => {
    const result = generateZenginCsv(transfers, source, { bank: "rakuten" });
    expect(result.recordCount).toBe(2);
    expect(result.totalAmount).toBe(125000);
  });

  it("みずほは .txt + EOF マーク", () => {
    const result = generateZenginCsv(transfers, source, { bank: "mizuho" });
    expect(result.filename).toMatch(/\.txt$/);
    expect(result.content[result.content.length - 1]).toBe(0x1a);
  });

  it("PayPay は .csv、EOF なし", () => {
    const result = generateZenginCsv(transfers, source, { bank: "paypay" });
    expect(result.filename).toMatch(/\.csv$/);
    expect(result.content[result.content.length - 1]).not.toBe(0x1a);
  });

  it("バリデーション失敗なら Error を投げる", () => {
    const invalid = [{ ...transfers[0], amount: 0 }];
    expect(() =>
      generateZenginCsv(invalid, source, { bank: "rakuten" }),
    ).toThrow(/金額は 1 円以上/);
  });

  it("空配列なら Error", () => {
    expect(() =>
      generateZenginCsv([], source, { bank: "rakuten" }),
    ).toThrow(/振込データが空/);
  });

  it("京都銀行は未実装エラー", () => {
    expect(() =>
      generateZenginCsv(transfers, source, { bank: "kyoto" }),
    ).toThrow(/未実装/);
  });
});
