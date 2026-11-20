import { describe, expect, it } from "vitest";
import { convertOrder, parseOrderCsv } from "./import-fm-csv.core";

describe("FileMaker の受注 CSV", () => {
  it("BOM、CRLF、備考の改行、カンマ、引用符を読む", () => {
    const input = '\uFEFF主キー,管理番号,備考\r\n1,ＰＤ001,"一行目, ""引用""\r\n二行目"\r\n';
    expect(parseOrderCsv(input)).toEqual([
      { 主キー: "1", 管理番号: "ＰＤ001", 備考: '一行目, "引用"\r\n二行目' },
    ]);
  });

  it("管理番号、正確な数値、日付、時刻と旧契約の項目を取り込む", () => {
    expect(convertOrder({
      主キー: "9007199254740993", 管理番号: "PD００１２（２）", 受注日: "2024-02-29",
      取消日: "2025-02-29", エントリー日: "(日付不正)", 諸元回収日: "abc", 請求金額: "１２,３４５.５０",
      作成日: "2026-11-20T12:30:00+09:00", 修正日: "", 新契約者名義_漢字: " ",
      現契約名義_漢字: "山田 太郎", 新契約者名義_カナ: "ヤマダ タロウ", "現使用場所住所_〒": "123-4567",
      現使用場所住所1: "大阪市", 現使用場所住所2: "中央区", 電話番号1: "01234", 電灯_お客様番号: "00001",
      進捗: "エントリー完了", "申込ﾌﾟﾗﾝ": "プラン",
    })).toMatchObject({
      fm_pk: "9007199254740993", kanri_no: "12", kanri_no_raw: "PD００１２（２）",
      ordered_on: "2024-02-29", cancelled_on: null, entered_on: null, specs_on: null, billing_amount: "12345.50",
      fm_created_at: "2026-11-20T12:30:00+09:00", fm_updated_at: null, customer_name: "山田 太郎",
      customer_kana: "ヤマダ タロウ", postal_code: "123-4567", address: "大阪市中央区",
      phone: "01234", denki_customer_no: "00001", progress: "エントリー完了", plan: "プラン",
    });
  });

  it("新住所があれば現住所と混ぜない", () => {
    expect(convertOrder({ 主キー: "1", 新使用場所住所2: "中央区", 現使用場所住所1: "別の住所" }).address).toBe("中央区");
  });

  it("変換できない主キーと壊れた CSV を検知する", () => {
    expect(() => convertOrder({ 主キー: "abc" })).toThrow("主キー");
    expect(() => parseOrderCsv("管理番号,備考\n1,メモ")).toThrow("見出し");
    expect(() => parseOrderCsv("主キー,備考\n1")).toThrow("項目数");
    expect(() => parseOrderCsv('主キー,備考\n1,"メモ')).toThrow("引用符");
  });
});
