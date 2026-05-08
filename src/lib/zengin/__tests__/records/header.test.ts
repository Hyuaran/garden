import { describe, it, expect } from "vitest";
import { buildHeaderRecord } from "../../records/header";
import type { ZenginSourceAccount } from "../../types";

const sourceAccount: ZenginSourceAccount = {
  consignor_code: "0000001234",
  consignor_name: "ｶ)ﾋｭｱﾗﾝ",
  transfer_date: "0425",
  source_bank_code: "0036",
  source_bank_name: "ﾗｸﾃﾝ",
  source_branch_code: "251",
  source_branch_name: "ﾀﾞｲｲﾁｴｲｷﾞｮｳ",
  source_account_type: "1",
  source_account_number: "7853952",
};

describe("buildHeaderRecord", () => {
  it("ヘッダレコードが 120 byte 固定長", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.length).toBe(120);
  });

  it("レコード種別が '1'（ヘッダ）で始まる", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record[0]).toBe("1");
  });

  it("種別コード '21'（総合振込）が2桁目以降にある", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(1, 3)).toBe("21");
  });

  it("コード区分が '0'（JIS漢字）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(3, 4)).toBe("0");
  });

  it("依頼人コードが10桁で入る", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(4, 14)).toBe("0000001234");
  });

  it("依頼人名が40桁で左詰め、右側空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    const consignorNameField = record.substring(14, 54);
    expect(consignorNameField.length).toBe(40);
    expect(consignorNameField.trim()).toBe("ｶ)ﾋｭｱﾗﾝ");
  });

  it("振込指定日が4桁（MMDD）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(54, 58)).toBe("0425");
  });

  it("振込元金融機関コードが4桁", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(58, 62)).toBe("0036");
  });

  it("振込元金融機関名が15桁で左詰め右空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(62, 77).trim()).toBe("ﾗｸﾃﾝ");
    expect(record.substring(62, 77).length).toBe(15);
  });

  it("振込元支店コードが3桁", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(77, 80)).toBe("251");
  });

  it("振込元支店名が15桁で左詰め右空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(80, 95).trim()).toBe("ﾀﾞｲｲﾁｴｲｷﾞｮｳ");
  });

  it("振込元預金種目（1桁）と口座番号（7桁）", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(95, 96)).toBe("1");
    expect(record.substring(96, 103)).toBe("7853952");
  });

  it("末尾のダミー（17桁）が空白埋め", () => {
    const record = buildHeaderRecord(sourceAccount);
    expect(record.substring(103, 120)).toBe(" ".repeat(17));
  });
});
