/**
 * 京都銀行 CSV パーサー テスト
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import { parseKyotoCsv } from "../parsers/bank/kyoto";
import { BankParserError } from "../types";

const HEADER =
  '"営業店","番号","お取引日","(年センター)","お引出金額(円)","お預入金額(円)","入支出区分","残高(円)","取引区分","明細区分","金融機関名","支店名","摘要"';

function toSjis(s: string): Buffer {
  return iconv.encode(s, "Shift_JIS");
}

function makeCsv(lines: string[]): Buffer {
  return toSjis(lines.join("\r\n"));
}

describe("parseKyotoCsv", () => {
  it("ヘッダーのみ → 空", () => {
    const buf = makeCsv([HEADER]);
    const result = parseKyotoCsv(buf);
    expect(result.bank_kind).toBe("kyoto");
    expect(result.rows).toHaveLength(0);
  });

  it("出金行 (お引出金額あり) → withdrawal", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年04月01日","","417,000","","","6,608,283","出金","","","","ご返済 4回目"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2026-04-01",
      amount: 417000,
      flow: "withdrawal",
      description: "ご返済 4回目",
      balance_after: 6608283,
    });
  });

  it("入金行 (お預入金額あり) → deposit", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年04月15日","","","100,000","","6,708,283","入金","","","","売上入金"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2026-04-15",
      amount: 100000,
      flow: "deposit",
      description: "売上入金",
      balance_after: 6708283,
    });
  });

  it("カンマ付き数字を正しく parse", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年03月12日","","550","","","7,025,283","出金","","","","EB手数料"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows[0].amount).toBe(550);
    expect(result.rows[0].balance_after).toBe(7025283);
  });

  it("漢字日付の月日が 1 桁でも parse", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年4月1日","","417,000","","","6,608,283","出金","","","","ご返済"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows[0].transaction_date).toBe("2026-04-01");
  });

  it("期初残高 (出金始まり) = balance + 出金額", () => {
    // 1 行目: 出金 550 → 残高 7,025,283 → 期初 = 7,025,833
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年03月12日","","550","","","7,025,283","出金","","","","EB手数料"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.opening_balance).toBe(7025833);
  });

  it("お引出/お預入 両方空 → warning + skip", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年04月01日","","","","","6,608,283","","","","",""',
      '"難波支店(514) 普通 29830","001","2026年04月02日","","100","","","6,608,183","出金","","","","x"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("両方値ありは warning + skip", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","2026年04月01日","","100","200","","6,608,283","","","","","x"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings.length).toBe(1);
  });

  it("不正な日付 → warning + skip", () => {
    const buf = makeCsv([
      HEADER,
      '"難波支店(514) 普通 29830","001","invalid date","","550","","","7,025,283","出金","","","","x"',
      '"難波支店(514) 普通 29830","001","2026年04月01日","","100","","","7,025,183","出金","","","","y"',
    ]);
    const result = parseKyotoCsv(buf);
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.reason.includes("日付"))).toBe(true);
  });

  it("strict mode: ヘッダーなしで throw", () => {
    const buf = makeCsv([
      '"難波支店(514) 普通 29830","001","2026年04月01日","","100","","","7,025,183","出金","","","","x"',
    ]);
    expect(() => parseKyotoCsv(buf)).toThrow(BankParserError);
  });
});
