/**
 * CSV ユーティリティ テスト
 */

import { describe, it, expect } from "vitest";
import {
  parseCsvRfc4180,
  parseGroupedNumber,
  parseKanjiDate,
} from "../csv-utils";

describe("parseCsvRfc4180", () => {
  it("シンプルな CSV", () => {
    const result = parseCsvRfc4180("a,b,c\nd,e,f");
    expect(result).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("ダブルクォート囲み", () => {
    const result = parseCsvRfc4180('"a","b","c"\n"d","e","f"');
    expect(result).toEqual([
      ["a", "b", "c"],
      ["d", "e", "f"],
    ]);
  });

  it("クォート内のカンマ", () => {
    const result = parseCsvRfc4180('"a,b","c"\n"d","e,f"');
    expect(result).toEqual([
      ["a,b", "c"],
      ["d", "e,f"],
    ]);
  });

  it("クォート内のダブルクォート (エスケープ)", () => {
    const result = parseCsvRfc4180('"a""b","c"');
    expect(result).toEqual([['a"b', "c"]]);
  });

  it("クォート内の改行", () => {
    const result = parseCsvRfc4180('"a\nb","c"');
    expect(result).toEqual([["a\nb", "c"]]);
  });

  it("CRLF 改行", () => {
    const result = parseCsvRfc4180("a,b\r\nc,d");
    expect(result).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("空フィールド", () => {
    const result = parseCsvRfc4180('"a","","c"');
    expect(result).toEqual([["a", "", "c"]]);
  });

  it("末尾改行のみ (空行を含めない)", () => {
    const result = parseCsvRfc4180("a,b,c\n");
    expect(result).toEqual([["a", "b", "c"]]);
  });

  it("PayPay 行 (実データ模倣)", () => {
    const line =
      '"2025","7","31","17","11","54","0000101","振込 カニセンタ-ライズ","","2000000","2000000",""';
    const result = parseCsvRfc4180(line);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(12);
    expect(result[0][0]).toBe("2025");
    expect(result[0][7]).toBe("振込 カニセンタ-ライズ");
    expect(result[0][9]).toBe("2000000");
  });

  it("京都銀行 行 (カンマ付き数字 + 漢字日付)", () => {
    const line =
      '"難波支店(514) 普通 29830","001","2026年04月01日","","417,000","","","6,608,283","出金","","","","ご返済 4回目"';
    const result = parseCsvRfc4180(line);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(13);
    expect(result[0][2]).toBe("2026年04月01日");
    expect(result[0][4]).toBe("417,000");
    expect(result[0][7]).toBe("6,608,283");
    expect(result[0][8]).toBe("出金");
  });

  it("空入力", () => {
    expect(parseCsvRfc4180("")).toEqual([]);
  });
});

describe("parseGroupedNumber", () => {
  it("カンマ付き数字", () => {
    expect(parseGroupedNumber("7,025,283")).toBe(7025283);
    expect(parseGroupedNumber("417,000")).toBe(417000);
  });

  it("カンマなし", () => {
    expect(parseGroupedNumber("100")).toBe(100);
    expect(parseGroupedNumber("0")).toBe(0);
  });

  it("マイナス符号", () => {
    expect(parseGroupedNumber("-1,234")).toBe(-1234);
    expect(parseGroupedNumber("-100")).toBe(-100);
  });

  it("小数点", () => {
    expect(parseGroupedNumber("100.5")).toBe(100.5);
    expect(parseGroupedNumber("1,000.50")).toBe(1000.5);
  });

  it("空文字 / 不正値は null", () => {
    expect(parseGroupedNumber("")).toBeNull();
    expect(parseGroupedNumber("   ")).toBeNull();
    expect(parseGroupedNumber("abc")).toBeNull();
    expect(parseGroupedNumber("1,2,3,4,5")).toBe(12345); // カンマは位置不問で許容
  });

  it("先頭末尾の空白", () => {
    expect(parseGroupedNumber("  100  ")).toBe(100);
  });
});

describe("parseKanjiDate", () => {
  it("YYYY年MM月DD日", () => {
    expect(parseKanjiDate("2026年04月01日")).toBe("2026-04-01");
    expect(parseKanjiDate("2026年12月31日")).toBe("2026-12-31");
  });

  it("月日が 1 桁でも対応 (zero pad)", () => {
    expect(parseKanjiDate("2026年4月1日")).toBe("2026-04-01");
    expect(parseKanjiDate("2026年4月01日")).toBe("2026-04-01");
  });

  it("不正な日付は null", () => {
    expect(parseKanjiDate("")).toBeNull();
    expect(parseKanjiDate("2026/04/01")).toBeNull();
    expect(parseKanjiDate("2026年13月01日")).toBeNull();
    expect(parseKanjiDate("2026年04月32日")).toBeNull();
    expect(parseKanjiDate("ABCDEF年04月01日")).toBeNull();
  });
});
