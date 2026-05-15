import { describe, it, expect } from "vitest";
import {
  transformKintoneApp55ToSoilList,
  detectKintoneCustomerType,
  type KintoneApp55Record,
} from "../soil-import-transform";

const baseRecord = (overrides: Partial<KintoneApp55Record> = {}): KintoneApp55Record => ({
  $id: { value: "12345" },
  電話番号: { value: "06-1234-5678" },
  漢字: { value: "山田 太郎" },
  カナ: { value: "ﾔﾏﾀﾞ ﾀﾛｳ" },
  郵便番号: { value: "530-0047" },
  都道府県: { value: "大阪府" },
  市区町村: { value: "大阪市北区" },
  住所: { value: "西天満4-3-25" },
  業種: { value: "事務所" },
  ...overrides,
});

describe("detectKintoneCustomerType", () => {
  it("法人名 / 代表者名のいずれかがあれば corporate", () => {
    expect(detectKintoneCustomerType({ 法人名: { value: "株式会社テスト" } } as KintoneApp55Record)).toBe("corporate");
    expect(detectKintoneCustomerType({ 代表者名: { value: "代表 太郎" } } as KintoneApp55Record)).toBe("corporate");
  });

  it("法人系列が空なら individual", () => {
    expect(detectKintoneCustomerType(baseRecord())).toBe("individual");
  });

  it("法人名が空文字なら individual", () => {
    expect(detectKintoneCustomerType(baseRecord({ 法人名: { value: "" } }))).toBe("individual");
  });
});

describe("transformKintoneApp55ToSoilList", () => {
  it("最小レコードを正規化済 SoilListInsert に変換", () => {
    const result = transformKintoneApp55ToSoilList(baseRecord());

    expect(result.source_system).toBe("kintone-app-55");
    expect(result.source_record_id).toBe("12345");
    expect(result.customer_type).toBe("individual");
    expect(result.name_kanji).toBe("山田 太郎");
    expect(result.name_kana).toBe("ヤマダ タロウ");                 // 半角→全角
    expect(result.phone_primary).toBe("+81612345678");                // E.164
    expect(result.postal_code).toBe("530-0047");
    expect(result.prefecture).toBe("大阪府");
    expect(result.city).toBe("大阪市北区");
    expect(result.address_line).toBe("西天満4-3-25");
    expect(result.industry_type).toBe("事務所");
  });

  it("法人名あり → customer_type=corporate", () => {
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ 法人名: { value: "株式会社テスト" }, 代表者名: { value: "代表 太郎" } }),
    );
    expect(result.customer_type).toBe("corporate");
    expect(result.name_kanji).toBe("株式会社テスト");
    expect(result.representative_name_kanji).toBe("代表 太郎");
  });

  it("supply_point_22 が 22 桁数字なら保持", () => {
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ 供給地点特定番号: { value: "0123456789012345678901" } }),
    );
    expect(result.supply_point_22).toBe("0123456789012345678901");
  });

  it("supply_point_22 が 22 桁でない / 数字以外なら null", () => {
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ 供給地点特定番号: { value: "12345" } }),
    );
    expect(result.supply_point_22).toBeNull();
  });

  it("電話番号空 → phone_primary は null", () => {
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ 電話番号: { value: "" } }),
    );
    expect(result.phone_primary).toBeNull();
  });

  it("郵便番号のハイフン除去（保持はそのまま、表示用に正規化はしない）", () => {
    // 仕様: postal_code は Kintone 値そのまま保持
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ 郵便番号: { value: "5300047" } }),
    );
    expect(result.postal_code).toBe("5300047");
  });

  it("source_channel は kintone_app55 に固定（B-03）", () => {
    const result = transformKintoneApp55ToSoilList(baseRecord());
    expect(result.source_channel).toBe("kintone_app55");
    expect(result.is_outside_list).toBe(false);
  });

  it("status は active 固定（取込時の既定）", () => {
    const result = transformKintoneApp55ToSoilList(baseRecord());
    expect(result.status).toBe("active");
  });

  it("phone_alternates / email_alternates は省略可（undefined）", () => {
    const result = transformKintoneApp55ToSoilList(baseRecord());
    expect(result.phone_alternates).toBeNull();
    expect(result.email_alternates).toBeNull();
  });

  it("addresses_jsonb は billing 一括ミラー", () => {
    const result = transformKintoneApp55ToSoilList(baseRecord());
    expect(result.addresses_jsonb).toEqual({
      billing: {
        postal_code: "530-0047",
        prefecture: "大阪府",
        city: "大阪市北区",
        address_line: "西天満4-3-25",
      },
    });
  });

  it("name_kana が undefined のとき空文字 → null 化", () => {
    const result = transformKintoneApp55ToSoilList(
      baseRecord({ カナ: { value: "" } }),
    );
    expect(result.name_kana).toBeNull();
  });

  it("$id 欠落時は source_record_id 空文字 → null", () => {
    const result = transformKintoneApp55ToSoilList(
      { ...baseRecord(), $id: { value: "" } },
    );
    expect(result.source_record_id).toBeNull();
  });
});
