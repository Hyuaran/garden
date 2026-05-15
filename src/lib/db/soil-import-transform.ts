/**
 * Garden-Soil Phase B-01: Kintone App 55 → soil_lists Transform
 *
 * 対応 spec:
 *   - docs/specs/2026-04-26-soil-phase-b-01-list-import-phase-1.md（B-01 Phase 1）
 *   - docs/specs/2026-04-25-soil-03-kanden-list-integration.md（#03 Kintone 74 fields 振分）
 *   - docs/specs/2026-04-26-soil-phase-b-03-kanden-master-integration.md（B-03 source_channel）
 *
 * 作成: 2026-05-07（Phase B-01 skeleton、a-soil）
 *
 * 役割:
 *   Kintone REST API から取得した raw レコード（{$id, 漢字, カナ, 電話番号, ...}）を
 *   soil_lists テーブルへの INSERT 入力（SoilListInsert）に変換する純粋関数。
 *
 *   Extract → [本関数] → Load の Transform 段階に対応。
 *
 * 設計方針:
 *   - 純粋関数（DB アクセスなし、外部依存は soil-helpers のみ）
 *   - TDD で開発（src/lib/db/__tests__/soil-import-transform.test.ts）
 *   - エラー時は throw せず、null 値を返す（Transform 失敗は呼出側で記録）
 */

import type { SoilListInsert, SoilCustomerType } from "./soil-types";
import { normalizePhone, normalizeKana } from "./soil-helpers";
import { isValidSupplyPoint22 } from "./soil-types";

// ============================================================
// Kintone App 55 raw record 型
// ============================================================

/** Kintone REST API の field 値 wrapper（すべて { value: string } 形式） */
type KintoneFieldValue = { value: string };

/**
 * Kintone App 55（関電リスト）の raw レコード型。
 * 実際の App 55 は 74 フィールドあるが、本変換で参照する主要フィールドのみ列挙。
 *
 * 未参照フィールドは Leaf 関電 spec #03 §3.2 / §3.3 の振分けに従い、
 * leaf_kanden_cases 側で取り扱う（本関数のスコープ外）。
 */
export type KintoneApp55Record = {
  // 識別系
  $id?: KintoneFieldValue;                              // Kintone レコード ID

  // 顧客系
  漢字?: KintoneFieldValue;                              // 個人氏名 or 法人名（漢字）
  カナ?: KintoneFieldValue;                              // 同（カナ、半角混在の可能性あり）
  法人名?: KintoneFieldValue;                            // 法人名（明示）
  代表者名?: KintoneFieldValue;                          // 法人代表者名

  // 連絡先
  電話番号?: KintoneFieldValue;                          // 主電話番号
  メール?: KintoneFieldValue;                            // 主メールアドレス

  // 住所
  郵便番号?: KintoneFieldValue;
  都道府県?: KintoneFieldValue;
  市区町村?: KintoneFieldValue;
  住所?: KintoneFieldValue;                              // 番地・建物名

  // 商材適性
  業種?: KintoneFieldValue;                              // 工場照明 / 飲食 / 商店 等

  // 関電固有（Soil 側に保持）
  供給地点特定番号?: KintoneFieldValue;                  // supply_point_22（22 桁、不変 ID）
  需要番号?: KintoneFieldValue;                          // pd_number
};

// ============================================================
// 顧客区分判定
// ============================================================

/**
 * Kintone レコードから customer_type（individual / corporate）を判定する。
 *
 * 判定規則:
 *   - 法人名 OR 代表者名 が空でなければ corporate
 *   - それ以外は individual
 */
export function detectKintoneCustomerType(
  record: KintoneApp55Record,
): SoilCustomerType {
  const corp = record.法人名?.value?.trim() ?? "";
  const rep = record.代表者名?.value?.trim() ?? "";
  if (corp !== "" || rep !== "") return "corporate";
  return "individual";
}

// ============================================================
// メイン変換関数
// ============================================================

/**
 * Kintone App 55 レコードを soil_lists 投入用の SoilListInsert に変換する。
 *
 * 変換規則:
 *   - 電話番号 → normalizePhone で +81 E.164 風に正規化
 *   - カナ → normalizeKana で全角統一
 *   - 法人 / 個人判定 → detectKintoneCustomerType
 *   - supply_point_22 → 22 桁数字検証、不正なら null
 *   - source_system = 'kintone-app-55'
 *   - source_channel = 'kintone_app55'（B-03）
 *   - is_outside_list = false（Kintone 経由 = リスト内）
 *   - status = 'active'（既定、後段で更新）
 *   - addresses_jsonb = billing にミラー（usage / delivery は別途）
 *
 * @param record Kintone API から取得した raw レコード
 * @returns SoilListInsert（soil_lists テーブルへの INSERT 入力）
 */
export function transformKintoneApp55ToSoilList(
  record: KintoneApp55Record,
): SoilListInsert {
  const customerType = detectKintoneCustomerType(record);

  // 顧客名: 法人なら法人名、個人なら漢字フィールド
  const nameKanji =
    customerType === "corporate"
      ? record.法人名?.value?.trim() || record.漢字?.value?.trim() || null
      : record.漢字?.value?.trim() || null;

  const repKanji = record.代表者名?.value?.trim() || null;

  const nameKanaRaw = record.カナ?.value?.trim() ?? "";
  const nameKana = nameKanaRaw === "" ? null : normalizeKana(nameKanaRaw);

  const sourceRecordId = record.$id?.value?.trim() || null;

  const phonePrimary = normalizePhone(record.電話番号?.value);
  const emailPrimary = record.メール?.value?.trim() || null;

  const postalCode = record.郵便番号?.value?.trim() || null;
  const prefecture = record.都道府県?.value?.trim() || null;
  const city = record.市区町村?.value?.trim() || null;
  const addressLine = record.住所?.value?.trim() || null;

  const industryType = record.業種?.value?.trim() || null;

  // supply_point_22: 22 桁数字検証
  const sp22Raw = record.供給地点特定番号?.value?.trim() || null;
  const supplyPoint22 = isValidSupplyPoint22(sp22Raw) ? sp22Raw : null;

  const pdNumber = record.需要番号?.value?.trim() || null;

  // addresses_jsonb: billing にミラー（usage / delivery は Kintone App 55 にないため省略）
  const addressesJsonb =
    postalCode || prefecture || city || addressLine
      ? {
          billing: {
            postal_code: postalCode ?? "",
            prefecture: prefecture ?? "",
            city: city ?? "",
            address_line: addressLine ?? "",
          },
        }
      : null;

  return {
    source_system: "kintone-app-55",
    source_record_id: sourceRecordId,

    customer_type: customerType,
    name_kanji: nameKanji,
    name_kana: nameKana,
    representative_name_kanji: repKanji,
    representative_name_kana: null, // App 55 にカナ列なし

    phone_primary: phonePrimary,
    phone_alternates: null,
    email_primary: emailPrimary,
    email_alternates: null,

    postal_code: postalCode,
    prefecture: prefecture,
    city: city,
    address_line: addressLine,
    addresses_jsonb: addressesJsonb,

    industry_type: industryType,
    business_size: null,

    status: "active",
    status_changed_at: null,
    status_changed_by: null,
    donotcall_reason: null,

    merged_into_id: null,

    primary_case_module: null,
    primary_case_id: null,

    supply_point_22: supplyPoint22,
    pd_number: pdNumber,
    old_pd_numbers: null,

    is_outside_list: false,
    source_channel: "kintone_app55",

    list_no: null,
    created_by: null,
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
    deleted_reason: null,
  };
}
