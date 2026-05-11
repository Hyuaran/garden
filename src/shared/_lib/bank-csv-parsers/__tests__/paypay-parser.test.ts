/**
 * PayPay 銀行 CSV パーサー テスト
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { parsePayPayCsv } from "../paypay-parser";
import { BankParserError } from "../types";

const HEADER =
  '"取引日(年)","取引日(月)","取引日(日)","操作時刻(時)","操作時刻(分)","操作時刻(秒)","取引先番号","摘要","お支払金額","お預り金額","残高","備考"';

function toSjis(s: string): Buffer {
  return iconv.encode(s, "Shift_JIS");
}

function makeCsv(lines: string[]): Buffer {
  return toSjis(lines.join("\r\n"));
}

describe("parsePayPayCsv", () => {
  it("ヘッダーのみ → 空", () => {
    const buf = makeCsv([HEADER]);
    const result = parsePayPayCsv(buf);
    expect(result.bank_kind).toBe("paypay");
    expect(result.rows).toHaveLength(0);
  });

  it("入金行 (お預り金額あり) → deposit", () => {
    const buf = makeCsv([
      HEADER,
      '"2025","7","31","17","11","54","0000101","振込 カニセンタ-ライズ","","2000000","2000000",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2025-07-31",
      amount: 2000000,
      flow: "deposit",
      description: "振込 カニセンタ-ライズ",
      balance_after: 2000000,
    });
  });

  it("出金行 (お支払金額あり) → withdrawal", () => {
    const buf = makeCsv([
      HEADER,
      '"2026","4","30","4","36","5","0000202","振込手数料","145","","1291259",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2026-04-30",
      amount: 145,
      flow: "withdrawal",
      description: "振込手数料",
      balance_after: 1291259,
    });
  });

  it("期初残高 = 1 行目残高 - 1 行目入出金額", () => {
    // 1 行目入金 2,000,000, 残高 2,000,000 → 期初 = 0
    const buf = makeCsv([
      HEADER,
      '"2025","7","31","17","11","54","0000101","入金","","2000000","2000000",""',
      '"2025","8","1","18","27","35","0000201","支払","47380","","1952620",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.opening_balance).toBe(0);
    expect(result.closing_balance).toBe(1952620);
  });

  it("期初残高 (出金始まり) = 1 行目残高 + 1 行目出金額", () => {
    const buf = makeCsv([
      HEADER,
      '"2025","8","1","18","27","35","0000201","支払","47380","","1952620",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.opening_balance).toBe(1952620 + 47380);
  });

  it("お支払/お預り 両方空 → warning + skip", () => {
    const buf = makeCsv([
      HEADER,
      '"2025","8","1","0","15","19","0000101","残高調整","","","2000000",""',
      '"2025","8","2","0","15","19","0000101","入金","","100","2000100",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.reason.includes("お支払"))).toBe(true);
  });

  it("摘要のスペースを保持する", () => {
    const buf = makeCsv([
      HEADER,
      '"2025","8","27","12","6","33","0000101","PE アホウドリエ","8100","","1944529",""',
    ]);
    const result = parsePayPayCsv(buf);
    expect(result.rows[0].description).toBe("PE アホウドリエ");
  });

  it("strict mode: ヘッダーなしで throw", () => {
    const buf = makeCsv(['"2025","8","27","12","6","33","0000101","x","100","","1000",""']);
    expect(() => parsePayPayCsv(buf)).toThrow(BankParserError);
  });
});
