import { describe, it, expect } from "vitest";
import {
  parseRakutenCsv,
  parseMizuhoCsv,
  parsePayPayCsv,
  detectSourceType,
  parseStatementCsv,
} from "../statement-csv-parser";

describe("detectSourceType", () => {
  it("楽天銀行ヘッダーを検出", () => {
    const csv = "取引日,入出金（円）,取引後残高（円）,取引内容\n2026/04/25,1000,5000,テスト";
    expect(detectSourceType(csv)).toBe("rakuten_csv");
  });

  it("みずほ銀行ヘッダーを検出", () => {
    const csv = "日付,お取引内容,お引出し,お預入,残高\n2026/04/25,テスト,1000,,5000";
    expect(detectSourceType(csv)).toBe("mizuho_csv");
  });

  it("PayPay 銀行ヘッダーを検出", () => {
    const csv = "取引日,摘要,出金額,入金額,残高\n2026/04/25,テスト,,1000,5000";
    expect(detectSourceType(csv)).toBe("paypay_csv");
  });

  it("不明な形式は null", () => {
    expect(detectSourceType("col1,col2,col3\nval1,val2,val3")).toBeNull();
    expect(detectSourceType("")).toBeNull();
  });
});

describe("parseRakutenCsv", () => {
  it("正常なデータをパース", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      "2026/04/25,1000,5000,入金テスト",
      "2026/04/26,-500,4500,出金テスト",
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      transaction_date: "2026-04-25",
      amount: 1000,
      balance_after: 5000,
      description: "入金テスト",
    });
    expect(result.rows[1].amount).toBe(-500);
  });

  it("マイナス記号は出金（負数）", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      "2026/04/25,−1250000,3750000,ABC商事",
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.rows[0].amount).toBe(-1250000);
  });

  it("カンマ付きの金額をパース", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      '2026/04/25,"1,250,000","3,750,000",入金',
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.rows[0].amount).toBe(1250000);
    expect(result.rows[0].balance_after).toBe(3750000);
  });

  it("不正な日付はエラー行として記録", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      "invalid-date,1000,5000,テスト",
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("日付");
  });

  it("摘要が空の行はエラー", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      "2026/04/25,1000,5000,",
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it("ヘッダー行のみは空 rows", () => {
    const csv = "取引日,入出金（円）,取引後残高（円）,取引内容";
    const result = parseRakutenCsv(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("raw_row にヘッダー名で全フィールド保持", () => {
    const csv = [
      "取引日,入出金（円）,取引後残高（円）,取引内容",
      "2026/04/25,1000,5000,入金",
    ].join("\n");
    const result = parseRakutenCsv(csv);
    expect(result.rows[0].raw_row).toEqual({
      取引日: "2026/04/25",
      "入出金（円）": "1000",
      "取引後残高（円）": "5000",
      取引内容: "入金",
    });
  });
});

describe("parseMizuhoCsv", () => {
  it("お引出し → 負数、お預入 → 正数", () => {
    const csv = [
      "日付,お取引内容,お引出し,お預入,残高",
      "2026/04/25,振込 タイニ,1250000,,3750000",
      "2026/04/26,給与振込,,500000,4250000",
    ].join("\n");
    const result = parseMizuhoCsv(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].amount).toBe(-1250000);
    expect(result.rows[1].amount).toBe(500000);
  });

  it("両カラム空は amount=0（フィルタ前提のシステム取込済記録）", () => {
    const csv = [
      "日付,お取引内容,お引出し,お預入,残高",
      "2026/04/25,残高照会,,,5000000",
    ].join("\n");
    const result = parseMizuhoCsv(csv);
    expect(result.rows[0].amount).toBe(0);
  });

  it("日付フォーマット 2026-04-25 にも対応", () => {
    const csv = [
      "日付,お取引内容,お引出し,お預入,残高",
      "2026-04-25,テスト,,1000,5000",
    ].join("\n");
    const result = parseMizuhoCsv(csv);
    expect(result.rows[0].transaction_date).toBe("2026-04-25");
  });
});

describe("parsePayPayCsv", () => {
  it("出金額 → 負数、入金額 → 正数", () => {
    const csv = [
      "取引日,摘要,出金額,入金額,残高",
      "2026/04/25,引落し,500,,4500",
      "2026/04/26,入金,,1000,5500",
    ].join("\n");
    const result = parsePayPayCsv(csv);
    expect(result.rows[0].amount).toBe(-500);
    expect(result.rows[1].amount).toBe(1000);
  });
});

describe("parseStatementCsv", () => {
  it("sourceType に応じて正しいパーサが呼ばれる", () => {
    const rakutenCsv = "取引日,入出金（円）,取引後残高（円）,取引内容\n2026/04/25,1000,5000,テスト";
    const r = parseStatementCsv(rakutenCsv, "rakuten_csv");
    expect(r.rows).toHaveLength(1);
  });

  it("みずほ形式を mizuho_csv で渡せばパース成功", () => {
    const csv = "日付,お取引内容,お引出し,お預入,残高\n2026/04/25,テスト,,1000,5000";
    const r = parseStatementCsv(csv, "mizuho_csv");
    expect(r.rows[0].amount).toBe(1000);
  });
});
