/**
 * 楽天銀行 CSV パーサー テスト
 *
 * フィクスチャ生成は SJIS バッファを iconv-lite で UTF-8 文字列から作成。
 * 実 CSV の末尾残高との突合は別 integration test で実施 (G:\マイドライブ\..._chat_workspace\)。
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import {
  parseRakutenCsv,
  splitFirstN,
  parseRakutenDate,
  parseSignedInt,
} from "../parsers/bank/rakuten";
import { BankParserError } from "../types";

const HEADER = "取引日,入出金(円),残高(円),入出金先内容";

function toSjis(s: string): Buffer {
  return iconv.encode(s, "Shift_JIS");
}

function makeCsv(lines: string[]): Buffer {
  // 楽天 CSV は CRLF なので CRLF で結合
  return toSjis(lines.join("\r\n"));
}

describe("parseRakutenCsv", () => {
  describe("基本パース", () => {
    it("ヘッダーのみの空 CSV を扱える (rows=空)", () => {
      const buf = makeCsv([HEADER]);
      const result = parseRakutenCsv(buf);
      expect(result.bank_kind).toBe("rakuten");
      expect(result.rows).toHaveLength(0);
      expect(result.header_line_number).toBe(1);
      expect(result.opening_balance).toBeNull();
      expect(result.closing_balance).toBeNull();
    });

    it("1 行データをパースする", () => {
      const buf = makeCsv([HEADER, "20260401,300000,500000,給与振込"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toEqual({
        transaction_date: "2026-04-01",
        amount: 300000,
        flow: "deposit",
        description: "給与振込",
        balance_after: 500000,
        source_line_number: 2,
      });
    });

    it("複数行データをパースする", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,300000,500000,カニアラタ",
        "20260402,-34900,465100,PE 楽天市場",
        "20260403,-64600,400500,PE 楽天市場",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].flow).toBe("deposit");
      expect(result.rows[0].amount).toBe(300000);
      expect(result.rows[1].flow).toBe("withdrawal");
      expect(result.rows[1].amount).toBe(34900);
      expect(result.rows[2].flow).toBe("withdrawal");
      expect(result.rows[2].amount).toBe(64600);
    });
  });

  describe("符号と flow の対応", () => {
    it("正の金額 → deposit", () => {
      const buf = makeCsv([HEADER, "20260401,500000,1000000,入金"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].flow).toBe("deposit");
      expect(result.rows[0].amount).toBe(500000);
    });

    it("負の金額 → withdrawal (絶対値で amount に格納)", () => {
      const buf = makeCsv([HEADER, "20260401,-183300,17200,PE 楽天市場"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].flow).toBe("withdrawal");
      expect(result.rows[0].amount).toBe(183300);
    });

    it("0 円 → deposit (符号なし扱い)", () => {
      const buf = makeCsv([HEADER, "20260401,0,500000,残高調整"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].flow).toBe("deposit");
      expect(result.rows[0].amount).toBe(0);
    });
  });

  describe("期初残高 / 期末残高", () => {
    it("期初残高 = 1 行目残高 - 1 行目入出金額 で逆算", () => {
      // 1 行目: deposit 300,000 → balance_after 500,000
      // → 期初残高 = 500,000 - 300,000 = 200,000
      const buf = makeCsv([HEADER, "20260401,300000,500000,給与振込"]);
      const result = parseRakutenCsv(buf);
      expect(result.opening_balance).toBe(200000);
      expect(result.opening_balance_derivation).toBe(
        "csv_first_row_back_calculation",
      );
    });

    it("期初残高は出金行でも正しく逆算する", () => {
      // 1 行目: withdrawal -100,000 → balance_after 400,000
      // → 期初残高 = 400,000 - (-100,000) = 500,000
      const buf = makeCsv([HEADER, "20260401,-100000,400000,出金"]);
      const result = parseRakutenCsv(buf);
      expect(result.opening_balance).toBe(500000);
    });

    it("期末残高 = 最終データ行の残高", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,300000,500000,1",
        "20260402,100000,600000,2",
        "20260403,-50000,550000,3",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.closing_balance).toBe(550000);
    });
  });

  describe("摘要のカンマ含み (防御的処理)", () => {
    it("摘要内にカンマがある場合、最初の 3 カンマで分割し残りを再結合", () => {
      const buf = makeCsv([HEADER, "20260401,1000,5000,A,B,C"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].description).toBe("A,B,C");
    });

    it("摘要が空文字でもパースする", () => {
      const buf = makeCsv([HEADER, "20260401,1000,5000,"]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].description).toBe("");
    });

    it("摘要に括弧があってもパースする", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,-496461,20739,前期テナ家賃 株式会社レックスベス 普通預金 5815195 アコム",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows[0].description).toContain("レックスベス");
    });
  });

  describe("改行コード", () => {
    it("CRLF を扱う", () => {
      const buf = toSjis(`${HEADER}\r\n20260401,1000,5000,test\r\n`);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
    });

    it("LF のみでも扱う (フォールバック)", () => {
      const buf = toSjis(`${HEADER}\n20260401,1000,5000,test\n`);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
    });

    it("末尾に空行があっても問題ない", () => {
      const buf = toSjis(`${HEADER}\r\n20260401,1000,5000,test\r\n\r\n`);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe("ヘッダー検出", () => {
    it("strict mode (default): ヘッダーが無いと throw", () => {
      const buf = makeCsv(["20260401,1000,5000,test"]);
      expect(() => parseRakutenCsv(buf)).toThrow(BankParserError);
    });

    it("非 strict mode: ヘッダーが無くても warning で続行", () => {
      const buf = makeCsv(["20260401,1000,5000,test"]);
      const result = parseRakutenCsv(buf, { strict: false });
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.rows).toHaveLength(1);
    });

    it("ヘッダーが 2 行目以降にある場合も検出する", () => {
      const buf = makeCsv([
        "ダウンロード日: 2026/05/01",
        HEADER,
        "20260401,1000,5000,test",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.header_line_number).toBe(2);
      expect(result.rows).toHaveLength(1);
    });
  });

  describe("エラー処理 (warning に記録)", () => {
    it("不正な日付は warning + 行 skip", () => {
      const buf = makeCsv([
        HEADER,
        "INVALID,1000,5000,test",
        "20260401,2000,7000,ok",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("取引日");
    });

    it("不正な金額は warning + 行 skip", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,abc,5000,test",
        "20260402,2000,7000,ok",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("入出金額");
    });

    it("不正な残高は warning + 行 skip", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,1000,xyz,test",
        "20260402,2000,7000,ok",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("残高");
    });

    it("カンマが足りない行は warning + 行 skip", () => {
      const buf = makeCsv([
        HEADER,
        "20260401,1000,5000",
        "20260402,2000,7000,ok",
      ]);
      const result = parseRakutenCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("カンマ区切り");
    });
  });

  describe("空入力", () => {
    it("空 Buffer は warning なし、rows なし、header line=-1 (strict=false)", () => {
      const buf = Buffer.alloc(0);
      const result = parseRakutenCsv(buf, { strict: false });
      expect(result.rows).toHaveLength(0);
    });

    it("空 Buffer は throw する (strict=true)", () => {
      const buf = Buffer.alloc(0);
      expect(() => parseRakutenCsv(buf)).toThrow(BankParserError);
    });
  });
});

describe("splitFirstN", () => {
  it("通常の分割: 'a,b,c,d' を最初の 2 カンマで分割", () => {
    expect(splitFirstN("a,b,c,d", ",", 2)).toEqual(["a", "b", "c,d"]);
  });

  it("区切り文字より少ないカンマしかない場合", () => {
    expect(splitFirstN("a,b", ",", 5)).toEqual(["a", "b"]);
  });

  it("空文字", () => {
    expect(splitFirstN("", ",", 3)).toEqual([""]);
  });

  it("カンマが連続する場合 (空要素)", () => {
    expect(splitFirstN("a,,c", ",", 2)).toEqual(["a", "", "c"]);
  });

  it("最後の要素にカンマが残る", () => {
    expect(splitFirstN("a,b,c,d,e", ",", 3)).toEqual(["a", "b", "c", "d,e"]);
  });
});

describe("parseRakutenDate", () => {
  it("YYYYMMDD → YYYY-MM-DD", () => {
    expect(parseRakutenDate("20260401")).toBe("2026-04-01");
    expect(parseRakutenDate("20240705")).toBe("2024-07-05");
  });

  it("8 桁でない場合は null", () => {
    expect(parseRakutenDate("2026401")).toBeNull();
    expect(parseRakutenDate("202604011")).toBeNull();
  });

  it("数字以外を含む場合は null", () => {
    expect(parseRakutenDate("2026-04-01")).toBeNull();
    expect(parseRakutenDate("ABCDEFGH")).toBeNull();
  });

  it("不正な月日は null", () => {
    expect(parseRakutenDate("20261301")).toBeNull(); // 月 13
    expect(parseRakutenDate("20260100")).toBeNull(); // 日 0
    expect(parseRakutenDate("20260432")).toBeNull(); // 日 32
  });

  it("空文字は null", () => {
    expect(parseRakutenDate("")).toBeNull();
    expect(parseRakutenDate("   ")).toBeNull();
  });

  it("先頭末尾の空白を許容する", () => {
    expect(parseRakutenDate("  20260401  ")).toBe("2026-04-01");
  });
});

describe("parseSignedInt", () => {
  it("正の整数", () => {
    expect(parseSignedInt("100")).toBe(100);
    expect(parseSignedInt("0")).toBe(0);
  });

  it("負の整数", () => {
    expect(parseSignedInt("-100")).toBe(-100);
    expect(parseSignedInt("-1")).toBe(-1);
  });

  it("空白を許容する", () => {
    expect(parseSignedInt("  100  ")).toBe(100);
  });

  it("不正な値は null", () => {
    expect(parseSignedInt("")).toBeNull();
    expect(parseSignedInt("abc")).toBeNull();
    expect(parseSignedInt("1.5")).toBeNull();
    expect(parseSignedInt("1,000")).toBeNull(); // カンマ区切りは不可
    expect(parseSignedInt("+100")).toBeNull(); // プラス記号は許可しない
  });
});
