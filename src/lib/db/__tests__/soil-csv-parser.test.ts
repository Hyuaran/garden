/**
 * Garden-Soil Phase B-01 Phase 2: 自前 CSV パーサ TDD
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md §13 判 6（自前実装範囲、RFC 4180 準拠）
 *
 * テスト対象:
 *   - parseCsvText: in-memory テキスト → 行オブジェクト配列（小〜中ファイル / テスト用）
 *   - parseCsvLine: 1 行（quotes/commas のみ、複数行 cell 不可）
 *   - stripBom: UTF-8 BOM 除去
 */

import { describe, it, expect } from "vitest";
import {
  parseCsvText,
  parseCsvLine,
  stripBom,
  parseCsvLines,
  isQuoteBalanced,
} from "../soil-csv-parser";

// AsyncIterable from a string array helper
async function* asyncFromArray(items: string[]): AsyncGenerator<string> {
  for (const item of items) yield item;
}

async function collect<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

// ============================================================
// stripBom
// ============================================================

describe("stripBom", () => {
  it("UTF-8 BOM (\\uFEFF) を先頭から除去", () => {
    expect(stripBom("﻿hello")).toBe("hello");
  });

  it("BOM がなければそのまま", () => {
    expect(stripBom("hello")).toBe("hello");
  });

  it("空文字列はそのまま", () => {
    expect(stripBom("")).toBe("");
  });

  it("BOM が中間にあっても除去しない（先頭のみ）", () => {
    expect(stripBom("a﻿b")).toBe("a﻿b");
  });
});

// ============================================================
// parseCsvLine
// ============================================================

describe("parseCsvLine", () => {
  it("シンプルなカンマ区切り", () => {
    expect(parseCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("空セル", () => {
    expect(parseCsvLine("a,,c")).toEqual(["a", "", "c"]);
  });

  it("末尾の空セル", () => {
    expect(parseCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });

  it("先頭の空セル", () => {
    expect(parseCsvLine(",b,c")).toEqual(["", "b", "c"]);
  });

  it("ダブルクォート囲み", () => {
    expect(parseCsvLine('"a","b","c"')).toEqual(["a", "b", "c"]);
  });

  it("クォート内のカンマは保持", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });

  it('クォート内のエスケープ ""（連続2 つ）→ 単一 "', () => {
    expect(parseCsvLine('a,"he said ""hi""",c')).toEqual(["a", 'he said "hi"', "c"]);
  });

  it("日本語列ヘッダーも問題なく分割", () => {
    expect(parseCsvLine("管理番号,漢字氏名,電話番号1")).toEqual([
      "管理番号",
      "漢字氏名",
      "電話番号1",
    ]);
  });

  it("CRLF の \\r は trim", () => {
    expect(parseCsvLine("a,b,c\r")).toEqual(["a", "b", "c"]);
  });

  it("空行 → 1 セル空文字", () => {
    expect(parseCsvLine("")).toEqual([""]);
  });
});

// ============================================================
// parseCsvText
// ============================================================

describe("parseCsvText", () => {
  it("ヘッダー + 1 行", () => {
    const text = "管理番号,漢字氏名\nFM-1,山田 太郎";
    expect(parseCsvText(text)).toEqual([
      { 管理番号: "FM-1", 漢字氏名: "山田 太郎" },
    ]);
  });

  it("ヘッダー + 複数行", () => {
    const text = "a,b,c\n1,2,3\n4,5,6";
    expect(parseCsvText(text)).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("BOM 付きでもパース可", () => {
    const text = "﻿a,b\n1,2";
    expect(parseCsvText(text)).toEqual([{ a: "1", b: "2" }]);
  });

  it("CRLF 改行も対応", () => {
    const text = "a,b\r\n1,2\r\n3,4";
    expect(parseCsvText(text)).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("クォート内のカンマ（複数行 cell でない場合）", () => {
    const text = 'a,b\n"x,y",z';
    expect(parseCsvText(text)).toEqual([{ a: "x,y", b: "z" }]);
  });

  it("クォート内の改行（複数行 cell）", () => {
    const text = 'a,b\n"line1\nline2",z';
    expect(parseCsvText(text)).toEqual([{ a: "line1\nline2", b: "z" }]);
  });

  it('クォート内のエスケープ ""', () => {
    const text = 'a,b\n"he said ""hi""",z';
    expect(parseCsvText(text)).toEqual([{ a: 'he said "hi"', b: "z" }]);
  });

  it("空行はスキップ", () => {
    const text = "a,b\n1,2\n\n3,4\n";
    expect(parseCsvText(text)).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("ヘッダーのみ → 空配列", () => {
    expect(parseCsvText("a,b,c")).toEqual([]);
  });

  it("空テキスト → 空配列", () => {
    expect(parseCsvText("")).toEqual([]);
  });

  it("セル数がヘッダーより少ない行 → 不足列は空文字", () => {
    const text = "a,b,c\n1,2";
    expect(parseCsvText(text)).toEqual([{ a: "1", b: "2", c: "" }]);
  });

  it("セル数がヘッダーより多い行 → 余剰列は無視（厳格でない）", () => {
    const text = "a,b\n1,2,3,4";
    expect(parseCsvText(text)).toEqual([{ a: "1", b: "2" }]);
  });

  it("isQuoteBalanced: 偶数個 → true", () => {
    expect(isQuoteBalanced('a,"b",c')).toBe(true);
  });

  it("isQuoteBalanced: 奇数個（クォート未閉）→ false", () => {
    expect(isQuoteBalanced('a,"b,c')).toBe(false);
  });

  it("isQuoteBalanced: エスケープ \"\" は inQuote を変えない", () => {
    expect(isQuoteBalanced('a,"b""c"')).toBe(true);
    expect(isQuoteBalanced('a,"b""c')).toBe(false);
  });

  it("FileMaker 風の日本語ヘッダー + 値", () => {
    const text =
      "管理番号,個人法人区分,漢字氏名,電話番号1\n" +
      'FM-001,個人,"佐藤, 太郎",06-1234-5678\n' +
      "FM-002,法人,株式会社X,03-9876-5432";
    expect(parseCsvText(text)).toEqual([
      {
        管理番号: "FM-001",
        個人法人区分: "個人",
        漢字氏名: "佐藤, 太郎",
        電話番号1: "06-1234-5678",
      },
      {
        管理番号: "FM-002",
        個人法人区分: "法人",
        漢字氏名: "株式会社X",
        電話番号1: "03-9876-5432",
      },
    ]);
  });
});

// ============================================================
// parseCsvLines（ストリーミング）
// ============================================================

describe("parseCsvLines (streaming)", () => {
  it("物理行を 1 行ずつ受け取って行オブジェクトを yield", async () => {
    const lines = asyncFromArray(["a,b,c", "1,2,3", "4,5,6"]);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([
      { a: "1", b: "2", c: "3" },
      { a: "4", b: "5", c: "6" },
    ]);
  });

  it("BOM 付きヘッダーも処理", async () => {
    const lines = asyncFromArray(["﻿a,b", "1,2"]);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("クォート内の改行: 物理 2 行を 1 論理行に結合", async () => {
    const lines = asyncFromArray(['a,b', '"hello', 'world",z']);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([{ a: "hello\nworld", b: "z" }]);
  });

  it("空行スキップ", async () => {
    const lines = asyncFromArray(["a,b", "", "1,2", "", "3,4"]);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("ヘッダーのみ → 空", async () => {
    const lines = asyncFromArray(["a,b,c"]);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([]);
  });

  it("FileMaker 風: 日本語ヘッダー + クォート内カンマ", async () => {
    const lines = asyncFromArray([
      "管理番号,漢字氏名,電話番号1",
      'FM-001,"佐藤, 太郎",06-1234-5678',
    ]);
    const rows = await collect(parseCsvLines(lines));
    expect(rows).toEqual([
      {
        管理番号: "FM-001",
        漢字氏名: "佐藤, 太郎",
        電話番号1: "06-1234-5678",
      },
    ]);
  });
});
