/**
 * みずほ銀行 .api パーサー テスト
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import {
  parseMizuhoApi,
  deriveMizuhoFilenamePeriod,
} from "../parsers/bank/mizuho";
import { BankParserError } from "../types";

function toSjis(s: string): Buffer {
  return iconv.encode(s, "Shift_JIS");
}

/** みずほ .api の最低ヘッダー (実 .api 検証済 = 30 列) */
const HEADER_LINES = [
  // line 1: サービス名 (3 列)
  "サービス名\t0001\t0000",
  // line 2: 項目名 (col 0 = "項目名", 全 30 列, データ行と整合)
  "項目名\t月\t日\t時\t分\t依頼人名\t金融機関名\t支店名\t預金番号区分\t預金科目\t口座番号\t代替表示\t出金\t店内番号\t明細区分\t取扱日付月\t取扱日付日\t年戻金月\t年戻金日\t金額\t入支出区分\t摘要\t税法摘要\t税法番号\t業者番号\t金融機関名2\t支店名2\t振込メッセージ\t備考\t番号",
  // line 3: 項目属性
  "項目属性\tN\tN\tN\tN\tC\tC\tC\tC\tC\tC\tC\tC\tC\tC\tN\tN\tN\tN\tN\tC\tC\tN\tC\tC\tC\tC\tC\tC\tN",
  // line 4: 項目長
  "項目長\t2\t2\t2\t2\t48\t50\t23\t8\t10\t12\t1\t8\t4\t4\t2\t2\t2\t2\t14\t8\t48\t6\t6\t20\t15\t15\t20\t50\t3",
];

/**
 * データ行を生成 (col 0=明細, col 1=月, col 2=日, col 12=取引名, col 19=金額, col 21=摘要)
 * その他の列は ARATA データに準拠した値で埋める。
 */
function makeDataRow(
  month: string,
  day: string,
  transactionKind: "出金" | "入金",
  amountPadded: string,
  description: string,
): string {
  const cols = [
    "明細",          // col 0 type
    month,           // col 1 月
    day,             // col 2 日
    "09",            // col 3 時
    "07",            // col 4 分
    "株式会社ARATA", // col 5 依頼人名
    "みずほ銀行",    // col 6 金融機関名
    "四ツ橋支店",    // col 7 支店名
    "預金番号",      // col 8 預金番号区分
    "普通",          // col 9 預金科目
    "3026280",       // col 10 口座番号
    "",              // col 11 代替表示
    transactionKind, // col 12 出金 (値: "出金"/"入金")
    "001",           // col 13 店内番号
    "",              // col 14 明細区分
    month,           // col 15 取扱日付月
    day,             // col 16 取扱日付日
    month,           // col 17 年戻金月
    day,             // col 18 年戻金日
    amountPadded,    // col 19 金額
    "振替支払",      // col 20 入支出区分
    description,     // col 21 摘要
    "",              // col 22 税法摘要
    "",              // col 23 税法番号
    "",              // col 24 業者番号
    "",              // col 25 金融機関名2
    "",              // col 26 支店名2
    "",              // col 27 振込メッセージ
    "",              // col 28 備考
    "",              // col 29 番号
  ];
  return cols.join("\t");
}

function makeApi(...dataRows: string[]): Buffer {
  return toSjis([...HEADER_LINES, ...dataRows].join("\r\n"));
}

const DEFAULT_PERIOD = {
  startYear: 2025,
  startMonth: 4,
  endYear: 2026,
  endMonth: 4,
  endDay: 30,
};

describe("parseMizuhoApi", () => {
  it("ヘッダーのみで rows=空", () => {
    const buf = makeApi();
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.bank_kind).toBe("mizuho");
    expect(result.rows).toHaveLength(0);
    expect(result.opening_balance).toBeNull();
    expect(result.closing_balance).toBeNull();
  });

  it("1 行データをパース (出金)", () => {
    const buf = makeApi(
      makeDataRow("04", "10", "出金", "00003845631", "振替支払 入)テスト"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2025-04-10",
      amount: 3845631,
      flow: "withdrawal",
      description: "振替支払 入)テスト",
      balance_after: null,
    });
  });

  it("入金行は flow=deposit", () => {
    const buf = makeApi(
      makeDataRow("04", "15", "入金", "00001000000", "給与振込"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows[0].flow).toBe("deposit");
    expect(result.rows[0].amount).toBe(1000000);
  });

  it("年跨ぎ: 12月 → 1月で endYear に切替", () => {
    const buf = makeApi(
      makeDataRow("11", "01", "出金", "00000001000", "11月取引"),
      makeDataRow("12", "15", "出金", "00000002000", "12月取引"),
      makeDataRow("01", "10", "出金", "00000003000", "1月取引"),
      makeDataRow("02", "20", "出金", "00000004000", "2月取引"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].transaction_date).toBe("2025-11-01");
    expect(result.rows[1].transaction_date).toBe("2025-12-15");
    expect(result.rows[2].transaction_date).toBe("2026-01-10"); // 年跨ぎ
    expect(result.rows[3].transaction_date).toBe("2026-02-20");
  });

  it("最初が startMonth より小さければ endYear から開始", () => {
    // 期間 2025/04 〜 2026/04, 最初の月が 03 なら 2026/03 (startMonth=4 より小)
    const buf = makeApi(
      makeDataRow("03", "01", "出金", "00000001000", "3月取引"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows[0].transaction_date).toBe("2026-03-01");
  });

  it("摘要が空の行は skip + warning", () => {
    const buf = makeApi(
      makeDataRow("04", "10", "出金", "00000001000", ""),
      makeDataRow("04", "11", "出金", "00000002000", "OK"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.reason.includes("摘要"))).toBe(true);
  });

  it("月/日が不正な行は skip + warning", () => {
    const buf = makeApi(
      makeDataRow("13", "01", "出金", "00000001000", "不正月"),
      makeDataRow("04", "32", "出金", "00000001000", "不正日"),
      makeDataRow("04", "11", "出金", "00000002000", "OK"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.length).toBe(2);
  });

  it("金額が不正な行は skip + warning", () => {
    const buf = makeApi(
      makeDataRow("04", "10", "出金", "abc", "不正金額"),
      makeDataRow("04", "11", "出金", "00000002000", "OK"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows).toHaveLength(1);
    expect(result.warnings.some((w) => w.reason.includes("金額"))).toBe(true);
  });

  it("摘要の全角空白は半角空白に変換される", () => {
    const buf = makeApi(
      makeDataRow("04", "10", "出金", "00000001000", "前期テナ家賃　株式会社"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows[0].description).toBe("前期テナ家賃 株式会社");
  });

  it("balance_after は常に null (.api には残高列なし)", () => {
    const buf = makeApi(
      makeDataRow("04", "10", "出金", "00000001000", "test"),
    );
    const result = parseMizuhoApi(buf, { period: DEFAULT_PERIOD });
    expect(result.rows[0].balance_after).toBeNull();
    expect(result.opening_balance).toBeNull();
    expect(result.closing_balance).toBeNull();
  });

  it("strict=true で ヘッダー無いと throw", () => {
    const buf = toSjis("明細\t04\t10\t...");
    expect(() => parseMizuhoApi(buf, { period: DEFAULT_PERIOD })).toThrow(
      BankParserError,
    );
  });
});

describe("deriveMizuhoFilenamePeriod", () => {
  it("8+8 形式: '20260410から20260430まで'", () => {
    const period = deriveMizuhoFilenamePeriod(
      "nmr20260506093629_20260410から20260430まで.csv",
    );
    expect(period).toEqual({
      startYear: 2026,
      startMonth: 4,
      endYear: 2026,
      endMonth: 4,
      endDay: 30,
    });
  });

  it("6+8 形式 (ARATA): '202504から20260430まで'", () => {
    const period = deriveMizuhoFilenamePeriod(
      "HS000120260506095245_202504から20260430まで.api",
    );
    expect(period).toEqual({
      startYear: 2025,
      startMonth: 4,
      endYear: 2026,
      endMonth: 4,
      endDay: 30,
    });
  });

  it("6+6 形式: '202504から202604'", () => {
    const period = deriveMizuhoFilenamePeriod("foo_202504から202604.api");
    expect(period).toEqual({
      startYear: 2025,
      startMonth: 4,
      endYear: 2026,
      endMonth: 4,
      endDay: null,
    });
  });

  it("マッチしないファイル名は null", () => {
    expect(deriveMizuhoFilenamePeriod("foo.api")).toBeNull();
    expect(deriveMizuhoFilenamePeriod("HS00012026.api")).toBeNull();
  });
});
