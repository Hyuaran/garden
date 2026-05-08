import { describe, it, expect } from "vitest";
import { buildDataRecord } from "../../records/data";
import type { ZenginTransferInput } from "../../types";

const transfer: ZenginTransferInput = {
  payee_bank_code: "0001",
  payee_branch_code: "100",
  payee_account_type: "1",
  payee_account_number: "1234567",
  payee_account_holder_kana: "ﾔﾏﾀﾞ ﾀﾛｳ",
  amount: 50000,
  edi_info: "TEST EDI",
};

// テストヘルパ：8 桁右空白埋め
function padRight8(s: string): string {
  return (s + "        ").substring(0, 8);
}

describe("buildDataRecord", () => {
  it("データレコードが 120 byte 固定長", () => {
    const record = buildDataRecord(transfer);
    expect(record.length).toBe(120);
  });

  it("レコード種別が '2'（データ）で始まる", () => {
    expect(buildDataRecord(transfer)[0]).toBe("2");
  });

  it("振込先銀行コード（4桁）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(1, 5)).toBe("0001");
  });

  it("振込先銀行名（15桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(5, 20)).toBe(" ".repeat(15));
  });

  it("振込先支店コード（3桁）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(20, 23)).toBe("100");
  });

  it("振込先支店名（15桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(23, 38)).toBe(" ".repeat(15));
  });

  it("手形交換所番号（4桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(38, 42)).toBe(" ".repeat(4));
  });

  it("預金種目（1桁）と口座番号（7桁・0埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(42, 43)).toBe("1");
    expect(record.substring(43, 50)).toBe("1234567");
  });

  it("口座番号が4桁なら 0 で左埋めされる", () => {
    const t = { ...transfer, payee_account_number: "1234" };
    const record = buildDataRecord(t);
    expect(record.substring(43, 50)).toBe("0001234");
  });

  it("受取人名（30桁・左詰め右空白埋め）", () => {
    const record = buildDataRecord(transfer);
    const nameField = record.substring(50, 80);
    expect(nameField.trim()).toBe("ﾔﾏﾀﾞ ﾀﾛｳ");
    expect(nameField.length).toBe(30);
  });

  it("振込金額（10桁・右寄せ 0 埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(80, 90)).toBe("0000050000");
  });

  it("新規コード = '0'（1桁）", () => {
    expect(buildDataRecord(transfer).substring(90, 91)).toBe("0");
  });

  it("顧客コード1（10桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(91, 101)).toBe(" ".repeat(10));
  });

  it("顧客コード2（10桁・空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(101, 111)).toBe(" ".repeat(10));
  });

  it("EDI 情報（8桁・左詰め右空白埋め）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(111, 119)).toBe(padRight8("TEST EDI"));
  });

  it("振替区分 = '0'（1桁、末尾）", () => {
    const record = buildDataRecord(transfer);
    expect(record.substring(119, 120)).toBe("0");
  });

  it("EDI 情報が 8 桁を超える場合は切り詰められる", () => {
    const t = { ...transfer, edi_info: "ABCDEFGHIJ" };
    const record = buildDataRecord(t);
    expect(record.substring(111, 119)).toBe("ABCDEFGH");
  });

  it("EDI 情報なしでも 120 byte 固定", () => {
    const t = { ...transfer, edi_info: undefined };
    const record = buildDataRecord(t);
    expect(record.length).toBe(120);
  });

  it("顧客コードが指定されていれば入る", () => {
    const t: ZenginTransferInput = {
      ...transfer,
      customer_code_1: "ABC1234567",
      customer_code_2: "XYZ9876543",
    };
    const record = buildDataRecord(t);
    expect(record.substring(91, 101)).toBe("ABC1234567");
    expect(record.substring(101, 111)).toBe("XYZ9876543");
  });
});
