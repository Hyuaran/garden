/**
 * Garden-Soil Phase B-01 Phase 2: FileMaker CSV → KintoneApp55Record Adapter TDD
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md（B-01 Phase 2）
 *
 * テスト対象:
 *   - csvRowToKintoneRecord: FileMaker CSV 行 → KintoneApp55Record 互換変換
 *   - transformFileMakerCsvToSoilList: 上位 transform（既存 Phase 1 transform 再利用 + Phase 2 上書き）
 */

import { describe, it, expect } from "vitest";
import {
  csvRowToKintoneRecord,
  transformFileMakerCsvToSoilList,
  type FileMakerCsvRow,
} from "../soil-import-csv-source";

// ============================================================
// テストデータ helper
// ============================================================

const baseCsvRow = (overrides: Partial<FileMakerCsvRow> = {}): FileMakerCsvRow => ({
  管理番号: "FM-12345",
  個人法人区分: "個人",
  漢字氏名: "佐藤 花子",
  カナ氏名: "ｻﾄｳ ﾊﾅｺ",
  電話番号1: "06-9876-5432",
  郵便番号: "541-0041",
  都道府県: "大阪府",
  市区町村: "大阪市中央区",
  住所: "北浜3-1-2",
  業種: "飲食",
  ステータス: "active",
  ...overrides,
});

// ============================================================
// csvRowToKintoneRecord（Adapter）
// ============================================================

describe("csvRowToKintoneRecord", () => {
  it("管理番号 → $id", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.$id?.value).toBe("FM-12345");
  });

  it("漢字氏名 → 漢字", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.漢字?.value).toBe("佐藤 花子");
  });

  it("カナ氏名 → カナ（生値、正規化は transform で）", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.カナ?.value).toBe("ｻﾄｳ ﾊﾅｺ");
  });

  it("法人名 → 法人名 / 代表者名 → 代表者名", () => {
    const r = csvRowToKintoneRecord(
      baseCsvRow({ 法人名: "株式会社テスト", 代表者名: "代表 太郎" }),
    );
    expect(r.法人名?.value).toBe("株式会社テスト");
    expect(r.代表者名?.value).toBe("代表 太郎");
  });

  it("電話番号1 → 電話番号", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.電話番号?.value).toBe("06-9876-5432");
  });

  it("メール → メール", () => {
    const r = csvRowToKintoneRecord(
      baseCsvRow({ メール: "test@example.com" }),
    );
    expect(r.メール?.value).toBe("test@example.com");
  });

  it("郵便番号 / 都道府県 / 市区町村 / 住所 を直接マッピング", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.郵便番号?.value).toBe("541-0041");
    expect(r.都道府県?.value).toBe("大阪府");
    expect(r.市区町村?.value).toBe("大阪市中央区");
    expect(r.住所?.value).toBe("北浜3-1-2");
  });

  it("業種 → 業種", () => {
    const r = csvRowToKintoneRecord(baseCsvRow());
    expect(r.業種?.value).toBe("飲食");
  });

  it("欠損列は空文字 value", () => {
    const r = csvRowToKintoneRecord({ 管理番号: "X" });
    expect(r.$id?.value).toBe("X");
    expect(r.漢字?.value).toBe("");
    expect(r.電話番号?.value).toBe("");
  });
});

// ============================================================
// transformFileMakerCsvToSoilList（上位 transform）
// ============================================================

describe("transformFileMakerCsvToSoilList", () => {
  it("source_system は filemaker-list2024 に固定", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.source_system).toBe("filemaker-list2024");
  });

  it("source_channel は filemaker_export に固定", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.source_channel).toBe("filemaker_export");
  });

  it("is_outside_list は false（FileMaker 由来 = リスト内）", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.is_outside_list).toBe(false);
  });

  it("list_no = 管理番号", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.list_no).toBe("FM-12345");
  });

  it("source_record_id = 管理番号（fallback として FileMakerレコードID）", () => {
    const r1 = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r1.source_record_id).toBe("FM-12345");

    const r2 = transformFileMakerCsvToSoilList(
      baseCsvRow({ 管理番号: "", FileMakerレコードID: "INTERNAL-99" }),
    );
    expect(r2.source_record_id).toBe("INTERNAL-99");
  });

  it("customer_type: '個人' → individual / '法人' → corporate", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 個人法人区分: "個人" })).customer_type).toBe("individual");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 個人法人区分: "法人" })).customer_type).toBe("corporate");
  });

  it("customer_type: 英語値 individual / corporate も受付", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 個人法人区分: "individual" })).customer_type).toBe("individual");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 個人法人区分: "corporate" })).customer_type).toBe("corporate");
  });

  it("customer_type 未指定でも 法人名 / 代表者名があれば corporate", () => {
    const r = transformFileMakerCsvToSoilList(
      baseCsvRow({ 個人法人区分: undefined, 法人名: "株式会社X" }),
    );
    expect(r.customer_type).toBe("corporate");
  });

  it("name_kanji は法人時に法人名で上書き", () => {
    const r = transformFileMakerCsvToSoilList(
      baseCsvRow({ 個人法人区分: "法人", 法人名: "株式会社テスト", 漢字氏名: "代表者氏名" }),
    );
    expect(r.name_kanji).toBe("株式会社テスト");
  });

  it("name_kana は normalizeKana で全角統一（ｻﾄｳ → サトウ）", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.name_kana).toBe("サトウ ハナコ");
  });

  it("phone_primary は normalizePhone で +81 形式", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.phone_primary).toBe("+81698765432");
  });

  it("電話番号2 → phone_alternates[0]（type='other'）", () => {
    const r = transformFileMakerCsvToSoilList(
      baseCsvRow({ 電話番号2: "090-1111-2222" }),
    );
    expect(r.phone_alternates).toEqual([
      { number: "+819011112222", type: "other" },
    ]);
  });

  it("電話番号2 が空 / 不正 → phone_alternates は null", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 電話番号2: "" })).phone_alternates).toBeNull();
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 電話番号2: "abc" })).phone_alternates).toBeNull();
    expect(transformFileMakerCsvToSoilList(baseCsvRow()).phone_alternates).toBeNull();
  });

  it("業種 → industry_type / 規模 → business_size", () => {
    const r = transformFileMakerCsvToSoilList(
      baseCsvRow({ 業種: "工場照明", 規模: "small" }),
    );
    expect(r.industry_type).toBe("工場照明");
    expect(r.business_size).toBe("small");
  });

  it("規模: 日本語値 '極小'/'小'/'中'/'大' を canonical 形に変換", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "極小" })).business_size).toBe("micro");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "小" })).business_size).toBe("small");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "中" })).business_size).toBe("medium");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "大" })).business_size).toBe("large");
  });

  it("規模: 不正値 → null", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "unknown" })).business_size).toBeNull();
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ 規模: "" })).business_size).toBeNull();
    expect(transformFileMakerCsvToSoilList(baseCsvRow()).business_size).toBeNull();
  });

  it("ステータス: canonical 値はそのまま採用", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "active" })).status).toBe("active");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "casecreated" })).status).toBe("casecreated");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "churned" })).status).toBe("churned");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "donotcall" })).status).toBe("donotcall");
  });

  it("ステータス: 未指定 / 不正値 → 'active' 既定", () => {
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: undefined })).status).toBe("active");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "" })).status).toBe("active");
    expect(transformFileMakerCsvToSoilList(baseCsvRow({ ステータス: "garbage" })).status).toBe("active");
  });

  it("addresses_jsonb は billing にミラー（住所列があれば）", () => {
    const r = transformFileMakerCsvToSoilList(baseCsvRow());
    expect(r.addresses_jsonb).toEqual({
      billing: {
        postal_code: "541-0041",
        prefecture: "大阪府",
        city: "大阪市中央区",
        address_line: "北浜3-1-2",
      },
    });
  });

  it("住所列が全て空なら addresses_jsonb は null", () => {
    const r = transformFileMakerCsvToSoilList({
      管理番号: "X",
      漢字氏名: "山田",
    });
    expect(r.addresses_jsonb).toBeNull();
  });

  it("管理番号 が空 + FileMakerレコードID もない → list_no / source_record_id ともに null", () => {
    const r = transformFileMakerCsvToSoilList({
      漢字氏名: "山田",
      電話番号1: "090-1234-5678",
    });
    expect(r.list_no).toBeNull();
    expect(r.source_record_id).toBeNull();
  });

  it("メール → email_primary（trim 付き）", () => {
    const r = transformFileMakerCsvToSoilList(
      baseCsvRow({ メール: "  user@example.com  " }),
    );
    expect(r.email_primary).toBe("user@example.com");
  });
});
