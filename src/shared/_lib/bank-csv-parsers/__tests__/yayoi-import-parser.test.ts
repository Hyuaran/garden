/**
 * 弥生インポート CSV パーサー テスト
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import {
  parseYayoiImportCsv,
  parseYayoiDate,
  parseNonNegativeInt,
} from "../yayoi-import-parser";
import { BankParserError } from "../types";

function toSjis(s: string): Buffer {
  return iconv.encode(s, "Shift_JIS");
}

function makeCsv(lines: string[]): Buffer {
  return toSjis(lines.join("\r\n"));
}

/** 弥生 25 列行を生成 (col 0=2000, col 1=denpyo, col 3=date, col 4-15=仕訳, col 16=description, col 24="no") */
function makeRow(opts: {
  denpyoNo: number;
  date: string;
  debitAccount?: string;
  debitSub?: string;
  debitTax?: string;
  debitAmount?: number;
  debitTaxAmount?: number;
  creditAccount?: string;
  creditSub?: string;
  creditTax?: string;
  creditAmount?: number;
  creditTaxAmount?: number;
  description?: string;
}): string {
  return [
    "2000", // 0 identifier
    String(opts.denpyoNo), // 1
    "", // 2
    opts.date, // 3
    opts.debitAccount ?? "", // 4
    opts.debitSub ?? "", // 5
    "", // 6
    opts.debitTax ?? "", // 7
    String(opts.debitAmount ?? 0), // 8
    String(opts.debitTaxAmount ?? 0), // 9
    opts.creditAccount ?? "", // 10
    opts.creditSub ?? "", // 11
    "", // 12
    opts.creditTax ?? "", // 13
    String(opts.creditAmount ?? 0), // 14
    String(opts.creditTaxAmount ?? 0), // 15
    opts.description ?? "", // 16
    "", "", "0", "", "", "", "", // 17-23
    "no", // 24
  ].join(",");
}

describe("parseYayoiImportCsv", () => {
  describe("基本パース", () => {
    it("空 CSV → 空 rows", () => {
      const buf = makeCsv([]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(0);
      expect(result.row_count).toBe(0);
      expect(result.date_range).toBeNull();
    });

    it("1 行データをパース", () => {
      const buf = makeCsv([
        makeRow({
          denpyoNo: 1,
          date: "2025/4/1",
          debitAccount: "普通預金",
          debitSub: "みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン",
          debitTax: "対象外",
          debitAmount: 5000000,
          debitTaxAmount: 0,
          creditAccount: "普通預金",
          creditSub: "楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン",
          creditTax: "対象外",
          creditAmount: 5000000,
          creditTaxAmount: 0,
          description: "みずほ銀行 四ツ橋支店 普通預金 1252992 カニヒュアラン",
        }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toMatchObject({
        denpyo_no: 1,
        transaction_date: "2025-04-01",
        debit_account: "普通預金",
        debit_sub_account: "みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン",
        debit_tax_class: "対象外",
        debit_amount: 5000000,
        debit_tax_amount: 0,
        credit_account: "普通預金",
        credit_amount: 5000000,
        description: "みずほ銀行 四ツ橋支店 普通預金 1252992 カニヒュアラン",
      });
    });

    it("複数行データをパース + date_range 設定", () => {
      const buf = makeCsv([
        makeRow({ denpyoNo: 1, date: "2025/4/1", description: "A" }),
        makeRow({ denpyoNo: 2, date: "2025/4/15", description: "B" }),
        makeRow({ denpyoNo: 3, date: "2026/3/31", description: "C" }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(3);
      expect(result.row_count).toBe(3);
      expect(result.date_range).toEqual({ from: "2025-04-01", to: "2026-03-31" });
    });
  });

  describe("仕訳科目", () => {
    it("借方/貸方 + 補助科目 + 税区分 + 金額 + 税額", () => {
      const buf = makeCsv([
        makeRow({
          denpyoNo: 2,
          date: "2025/4/1",
          debitAccount: "支払手数料",
          debitTax: "課税仕入 10%",
          debitAmount: 229,
          debitTaxAmount: 21,
          creditAccount: "普通預金",
          creditSub: "楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン",
          creditTax: "対象外",
          creditAmount: 229,
          creditTaxAmount: 0,
          description: "振込手数料",
        }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows[0].debit_amount).toBe(229);
      expect(result.rows[0].debit_tax_amount).toBe(21);
      expect(result.rows[0].credit_amount).toBe(229);
      expect(result.rows[0].credit_tax_amount).toBe(0);
    });

    it("補助科目 / 税区分 が空でも OK", () => {
      const buf = makeCsv([
        makeRow({
          denpyoNo: 4,
          date: "2025/4/3",
          // 借方/貸方の科目自体も空 (要確認行)
          debitAccount: "",
          debitSub: "",
          debitTax: "",
          debitAmount: 156090,
          debitTaxAmount: 0,
          creditAccount: "",
          creditSub: "",
          creditTax: "",
          creditAmount: 156090,
          creditTaxAmount: 0,
          description: "カニクロスサポート",
        }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows[0]).toMatchObject({
        debit_account: "",
        debit_sub_account: "",
        debit_tax_class: "",
        credit_account: "",
        credit_amount: 156090,
      });
    });
  });

  describe("日付フォーマット", () => {
    it("YYYY/M/D (1 桁月日) → YYYY-MM-DD (zero pad)", () => {
      const buf = makeCsv([makeRow({ denpyoNo: 1, date: "2025/4/1" })]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows[0].transaction_date).toBe("2025-04-01");
    });

    it("YYYY/MM/DD (2 桁) もパース", () => {
      const buf = makeCsv([makeRow({ denpyoNo: 1, date: "2025/12/31" })]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows[0].transaction_date).toBe("2025-12-31");
    });

    it("不正な日付は warning + skip", () => {
      const buf = makeCsv([
        makeRow({ denpyoNo: 1, date: "2025-04-01", description: "ハイフン区切り NG" }),
        makeRow({ denpyoNo: 2, date: "2025/4/1", description: "OK" }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("伝票日付");
    });
  });

  describe("エラー処理", () => {
    it("列数 ≠ 25 は warning + skip", () => {
      const csv = "2000,1,,2025/4/1,普通預金,,,対象外,1000,0\r\n"; // 25 列に足りない
      const buf = toSjis(csv);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(0);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("列数");
    });

    it("identifier が 2000 でないと warning + skip", () => {
      const buf = makeCsv([
        makeRow({ denpyoNo: 1, date: "2025/4/1" }).replace(/^2000,/, "9999,"),
        makeRow({ denpyoNo: 2, date: "2025/4/2" }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("識別子");
    });

    it("strict mode で列数不正は throw", () => {
      const csv = "2000,1,,2025/4/1\r\n";
      const buf = toSjis(csv);
      expect(() => parseYayoiImportCsv(buf, { strict: true })).toThrow(
        BankParserError,
      );
    });

    it("不正な金額は warning + skip", () => {
      const buf = makeCsv([
        // 借方金額に "abc" を入れる
        "2000,1,,2025/4/1,普通預金,,,対象外,abc,0,普通預金,,,対象外,1000,0,test,,,0,,,,,no",
        makeRow({ denpyoNo: 2, date: "2025/4/1", description: "OK" }),
      ]);
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(1);
      expect(result.warnings.length).toBe(1);
      expect(result.warnings[0].reason).toContain("金額");
    });

    it("空行は無視 (warning なし)", () => {
      const buf = toSjis(
        `${makeRow({ denpyoNo: 1, date: "2025/4/1" })}\r\n\r\n${makeRow({ denpyoNo: 2, date: "2025/4/2" })}\r\n`,
      );
      const result = parseYayoiImportCsv(buf);
      expect(result.rows).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);
    });
  });
});

describe("parseYayoiDate", () => {
  it("YYYY/M/D → YYYY-MM-DD", () => {
    expect(parseYayoiDate("2025/4/1")).toBe("2025-04-01");
    expect(parseYayoiDate("2026/3/31")).toBe("2026-03-31");
  });

  it("YYYY/MM/DD もパース", () => {
    expect(parseYayoiDate("2025/04/01")).toBe("2025-04-01");
    expect(parseYayoiDate("2025/12/31")).toBe("2025-12-31");
  });

  it("不正な日付は null", () => {
    expect(parseYayoiDate("")).toBeNull();
    expect(parseYayoiDate("2025-04-01")).toBeNull(); // ハイフン
    expect(parseYayoiDate("2025/13/01")).toBeNull(); // 月 13
    expect(parseYayoiDate("2025/04/32")).toBeNull(); // 日 32
    expect(parseYayoiDate("abc")).toBeNull();
  });

  it("先頭末尾の空白を許容", () => {
    expect(parseYayoiDate("  2025/4/1  ")).toBe("2025-04-01");
  });
});

describe("parseNonNegativeInt", () => {
  it("正の整数", () => {
    expect(parseNonNegativeInt("100")).toBe(100);
    expect(parseNonNegativeInt("0")).toBe(0);
  });

  it("空文字 → 0", () => {
    expect(parseNonNegativeInt("")).toBe(0);
    expect(parseNonNegativeInt("  ")).toBe(0);
  });

  it("負数 → null (弥生 CSV は非負のみ)", () => {
    expect(parseNonNegativeInt("-100")).toBeNull();
  });

  it("不正な値 → null", () => {
    expect(parseNonNegativeInt("abc")).toBeNull();
    expect(parseNonNegativeInt("1.5")).toBeNull();
    expect(parseNonNegativeInt("1,000")).toBeNull();
  });
});
