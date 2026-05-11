/**
 * 弥生 CSV エクスポーター テスト + import 互換性確認
 */

import { describe, it, expect } from "vitest";
import iconv from "iconv-lite";
import {
  exportYayoiCsv,
  formatYayoiDate,
  sanitizeDescription,
  type YayoiExportRow,
} from "../yayoi-csv-exporter";
import { parseYayoiImportCsv } from "../yayoi-import-parser";

function fromSjis(buf: Buffer): string {
  return iconv.decode(buf, "Shift_JIS");
}

const SAMPLE_ROW: YayoiExportRow = {
  denpyo_no: 1,
  transaction_date: "2025-04-01",
  debit_account: "普通預金",
  debit_sub_account: "みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン",
  debit_tax_class: "対象外",
  debit_amount: 5000000,
  debit_tax_amount: 0,
  credit_account: "普通預金",
  credit_sub_account: "楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン",
  credit_tax_class: "対象外",
  credit_amount: 5000000,
  credit_tax_amount: 0,
  description: "口座振替",
};

describe("exportYayoiCsv", () => {
  describe("基本出力", () => {
    it("空配列 → 空 Buffer", () => {
      const buf = exportYayoiCsv([]);
      expect(buf.length).toBe(0);
    });

    it("1 行 → 25 列 + CRLF 末尾改行", () => {
      const buf = exportYayoiCsv([SAMPLE_ROW]);
      const text = fromSjis(buf);
      expect(text.endsWith("\r\n")).toBe(true);
      const lines = text.split("\r\n").filter((l) => l !== "");
      expect(lines).toHaveLength(1);
      const cols = lines[0].split(",");
      expect(cols).toHaveLength(25);
      expect(cols[0]).toBe("2000");
      expect(cols[1]).toBe("1");
      expect(cols[3]).toBe("2025/4/1");
      expect(cols[4]).toBe("普通預金");
      expect(cols[8]).toBe("5000000");
      expect(cols[24]).toBe("no");
    });

    it("複数行 → CRLF 区切り", () => {
      const buf = exportYayoiCsv([
        SAMPLE_ROW,
        { ...SAMPLE_ROW, denpyo_no: 2, transaction_date: "2025-04-15" },
        { ...SAMPLE_ROW, denpyo_no: 3, transaction_date: "2025-04-30" },
      ]);
      const text = fromSjis(buf);
      const lines = text.split("\r\n").filter((l) => l !== "");
      expect(lines).toHaveLength(3);
      expect(lines[0].split(",")[1]).toBe("1");
      expect(lines[1].split(",")[1]).toBe("2");
      expect(lines[2].split(",")[1]).toBe("3");
    });

    it("denpyo_no 省略時は index + 1 を使用", () => {
      const buf = exportYayoiCsv([
        { ...SAMPLE_ROW, denpyo_no: undefined },
        { ...SAMPLE_ROW, denpyo_no: undefined },
      ]);
      const text = fromSjis(buf);
      const lines = text.split("\r\n").filter((l) => l !== "");
      expect(lines[0].split(",")[1]).toBe("1");
      expect(lines[1].split(",")[1]).toBe("2");
    });
  });

  describe("optional フィールド省略", () => {
    it("補助科目省略 → 空文字", () => {
      const buf = exportYayoiCsv([
        {
          ...SAMPLE_ROW,
          debit_sub_account: undefined,
          credit_sub_account: undefined,
        },
      ]);
      const text = fromSjis(buf);
      const cols = text.split("\r\n")[0].split(",");
      expect(cols[5]).toBe("");
      expect(cols[11]).toBe("");
    });

    it("税区分省略 → 空文字", () => {
      const buf = exportYayoiCsv([
        {
          ...SAMPLE_ROW,
          debit_tax_class: undefined,
          credit_tax_class: undefined,
        },
      ]);
      const cols = fromSjis(buf).split("\r\n")[0].split(",");
      expect(cols[7]).toBe("");
      expect(cols[13]).toBe("");
    });

    it("消費税額省略 → 0", () => {
      const buf = exportYayoiCsv([
        {
          ...SAMPLE_ROW,
          debit_tax_amount: undefined,
          credit_tax_amount: undefined,
        },
      ]);
      const cols = fromSjis(buf).split("\r\n")[0].split(",");
      expect(cols[9]).toBe("0");
      expect(cols[15]).toBe("0");
    });
  });

  describe("Shift-JIS エンコーディング", () => {
    it("日本語が CP932 で正しくエンコード", () => {
      const buf = exportYayoiCsv([SAMPLE_ROW]);
      const decoded = fromSjis(buf);
      expect(decoded).toContain("普通預金");
      expect(decoded).toContain("みずほ銀行");
      expect(decoded).toContain("口座振替");
    });

    it("BOM なし (Python 出力と整合)", () => {
      const buf = exportYayoiCsv([SAMPLE_ROW]);
      // UTF-8 BOM: 0xEF 0xBB 0xBF / UTF-16 BOM: 0xFE 0xFF or 0xFF 0xFE
      expect(buf[0]).not.toBe(0xef);
      expect(buf[0]).not.toBe(0xfe);
      expect(buf[0]).not.toBe(0xff);
      // 先頭は "2" (0x32 = "2000" の先頭)
      expect(buf[0]).toBe(0x32);
    });
  });

  describe("摘要の防御的サニタイズ", () => {
    it("カンマ → 半角空白", () => {
      const buf = exportYayoiCsv([
        { ...SAMPLE_ROW, description: "A,B,C" },
      ]);
      const cols = fromSjis(buf).split("\r\n")[0].split(",");
      // 25 列維持
      expect(cols).toHaveLength(25);
      expect(cols[16]).toBe("A B C");
    });

    it("改行 → 半角空白", () => {
      const buf = exportYayoiCsv([
        { ...SAMPLE_ROW, description: "A\nB\r\nC" },
      ]);
      const cols = fromSjis(buf).split("\r\n")[0].split(",");
      expect(cols[16]).toBe("A B C");
    });
  });

  describe("trailingNewline オプション", () => {
    it("default = true → 末尾 CRLF あり", () => {
      const buf = exportYayoiCsv([SAMPLE_ROW]);
      const text = fromSjis(buf);
      expect(text.endsWith("\r\n")).toBe(true);
    });

    it("false → 末尾改行なし", () => {
      const buf = exportYayoiCsv([SAMPLE_ROW], { trailingNewline: false });
      const text = fromSjis(buf);
      expect(text.endsWith("\r\n")).toBe(false);
    });
  });

  describe("import/export 往復整合 (round-trip)", () => {
    it("export → import で同等データが再現される", () => {
      const original: YayoiExportRow = {
        denpyo_no: 5,
        transaction_date: "2025-04-15",
        debit_account: "支払手数料",
        debit_sub_account: "",
        debit_tax_class: "課税仕入 10%",
        debit_amount: 229,
        debit_tax_amount: 21,
        credit_account: "普通預金",
        credit_sub_account: "楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン",
        credit_tax_class: "対象外",
        credit_amount: 229,
        credit_tax_amount: 0,
        description: "振込手数料 (取引日 4月15日)",
      };

      // export → import
      const buf = exportYayoiCsv([original]);
      const parsed = parseYayoiImportCsv(buf);

      expect(parsed.rows).toHaveLength(1);
      const r = parsed.rows[0];
      expect(r.denpyo_no).toBe(5);
      expect(r.transaction_date).toBe("2025-04-15");
      expect(r.debit_account).toBe("支払手数料");
      expect(r.debit_tax_class).toBe("課税仕入 10%");
      expect(r.debit_amount).toBe(229);
      expect(r.debit_tax_amount).toBe(21);
      expect(r.credit_account).toBe("普通預金");
      expect(r.credit_amount).toBe(229);
      // 摘要のカンマはサニタイズで半角空白に
      expect(r.description).toBe("振込手数料 (取引日 4月15日)");
    });

    it("複数行 round-trip でも保たれる", () => {
      const originals: YayoiExportRow[] = [
        {
          ...SAMPLE_ROW,
          denpyo_no: 1,
          transaction_date: "2025-04-01",
          description: "1 行目",
        },
        {
          ...SAMPLE_ROW,
          denpyo_no: 2,
          transaction_date: "2025-04-02",
          description: "2 行目",
        },
        {
          ...SAMPLE_ROW,
          denpyo_no: 3,
          transaction_date: "2025-04-03",
          description: "3 行目",
        },
      ];

      const buf = exportYayoiCsv(originals);
      const parsed = parseYayoiImportCsv(buf);
      expect(parsed.rows).toHaveLength(3);
      expect(parsed.rows.map((r) => r.denpyo_no)).toEqual([1, 2, 3]);
      expect(parsed.rows.map((r) => r.description)).toEqual([
        "1 行目",
        "2 行目",
        "3 行目",
      ]);
    });
  });

  describe("Python fixture との形式一致 (ヘッダー要素検査)", () => {
    it("実 Python 出力 fixture と同パターンの行が再現できる", () => {
      // Python 出力例 (5_仕訳帳_弥生変換_v7.py):
      // 2000,1,,2025/4/1,普通預金,みずほ銀行_四ツ橋支店(普通預金)1252992_ヒュアラン,,対象外,5000000,0,普通預金,楽天銀行_第一営業支店(普通預金)7853952_ヒュアラン,,対象外,5000000,0,摘要文,,,0,,,,,no
      const buf = exportYayoiCsv([SAMPLE_ROW]);
      const text = fromSjis(buf);
      const cols = text.split("\r\n")[0].split(",");

      expect(cols).toHaveLength(25);
      expect(cols[0]).toBe("2000");
      expect(cols[2]).toBe(""); // empty
      expect(cols[6]).toBe(""); // empty
      expect(cols[12]).toBe(""); // empty
      expect(cols[19]).toBe("0"); // 0
      expect(cols[24]).toBe("no");
    });
  });
});

describe("formatYayoiDate", () => {
  it("YYYY-MM-DD → YYYY/M/D (1 桁月日, zero-pad なし)", () => {
    expect(formatYayoiDate("2025-04-01")).toBe("2025/4/1");
    expect(formatYayoiDate("2026-12-31")).toBe("2026/12/31");
    expect(formatYayoiDate("2025-04-15")).toBe("2025/4/15");
  });

  it("不正な形式は throw", () => {
    expect(() => formatYayoiDate("2025/4/1")).toThrow();
    expect(() => formatYayoiDate("")).toThrow();
    expect(() => formatYayoiDate("2025-13-01")).toThrow();
    expect(() => formatYayoiDate("2025-04-32")).toThrow();
  });
});

describe("sanitizeDescription", () => {
  it("カンマ → 半角空白", () => {
    expect(sanitizeDescription("A,B,C")).toBe("A B C");
  });

  it("CRLF / LF → 半角空白", () => {
    expect(sanitizeDescription("A\nB")).toBe("A B");
    expect(sanitizeDescription("A\r\nB")).toBe("A B");
  });

  it("通常文字列は変更なし", () => {
    expect(sanitizeDescription("普通預金 振込手数料")).toBe(
      "普通預金 振込手数料",
    );
    expect(sanitizeDescription("")).toBe("");
  });
});
