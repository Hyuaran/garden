/**
 * Garden-Soil Phase B-01 Phase 2: FileMaker CSV → KintoneApp55Record Adapter
 *
 * 対応 spec:
 *   - docs/specs/2026-05-08-soil-phase-b-01-phase-2-filemaker-csv.md（B-01 Phase 2）
 *
 * 作成: 2026-05-09（Phase B-01 Phase 2 実装、a-soil-002）
 *
 * 役割:
 *   FileMaker からエクスポートした CSV 行（{管理番号, 漢字氏名, 電話番号1, ...}）を
 *   既存 Phase 1 の transformKintoneApp55ToSoilList が受け付ける KintoneApp55Record
 *   形式に変換する Adapter + Phase 2 固有の上書き（source_system / list_no /
 *   business_size / status / phone_alternates 等）を適用する transform。
 *
 *   Extract（CSV → staging）→ [本ファイル] → Load の Transform 段階に対応。
 *
 * 設計方針:
 *   - 純粋関数（DB アクセスなし、外部依存は soil-helpers / soil-import-transform のみ）
 *   - TDD で開発（src/lib/db/__tests__/soil-import-csv-source.test.ts）
 *   - 既存 Phase 1 transform を変更せず、Adapter + 上書きで Phase 2 対応
 */

import type {
  SoilListInsert,
  SoilCustomerType,
  SoilBusinessSize,
  SoilListStatus,
  SoilPhoneAlternate,
} from "./soil-types";
import { normalizePhone } from "./soil-helpers";
import {
  transformKintoneApp55ToSoilList,
  type KintoneApp55Record,
} from "./soil-import-transform";

// ============================================================
// FileMaker CSV 行型
// ============================================================

/**
 * FileMaker エクスポート CSV の 1 行（ヘッダー = 日本語列名）。
 *
 * spec §3.2 の必須列に加え、識別系（FileMakerレコードID）/ 補助列（電話番号2 / メール / ステータス）を含む。
 * 全列任意（CSV 側で欠損の可能性）。
 */
export type FileMakerCsvRow = {
  // 識別
  管理番号?: string;
  FileMakerレコードID?: string;

  // 顧客
  個人法人区分?: string;       // '個人' | '法人' | 'individual' | 'corporate'
  漢字氏名?: string;
  カナ氏名?: string;
  法人名?: string;
  代表者名?: string;

  // 連絡先
  電話番号1?: string;
  電話番号2?: string;
  メール?: string;

  // 住所
  郵便番号?: string;
  都道府県?: string;
  市区町村?: string;
  住所?: string;

  // 商材適性
  業種?: string;
  規模?: string;               // '極小'|'小'|'中'|'大' | 'micro'|'small'|'medium'|'large'

  // 状態
  ステータス?: string;         // 'active'|'casecreated'|'churned'|'donotcall'|'merged'

  // 任意の追加列（型は緩く許容）
  [key: string]: string | undefined;
};

// ============================================================
// Adapter: CSV 行 → KintoneApp55Record 互換
// ============================================================

/**
 * FileMaker CSV 行を既存 Phase 1 transform が受け付ける KintoneApp55Record 形式に変換する。
 *
 * - 値は trim せず生値を保持（後段 transform で trim / 正規化）
 * - 欠損列は空文字 `{ value: "" }` で埋める（KintoneApp55Record の field 形式準拠）
 *
 * @param row FileMaker CSV 1 行
 * @returns KintoneApp55Record 互換オブジェクト
 */
export function csvRowToKintoneRecord(row: FileMakerCsvRow): KintoneApp55Record {
  return {
    $id: { value: row.管理番号 ?? "" },
    漢字: { value: row.漢字氏名 ?? "" },
    カナ: { value: row.カナ氏名 ?? "" },
    法人名: { value: row.法人名 ?? "" },
    代表者名: { value: row.代表者名 ?? "" },
    電話番号: { value: row.電話番号1 ?? "" },
    メール: { value: row.メール ?? "" },
    郵便番号: { value: row.郵便番号 ?? "" },
    都道府県: { value: row.都道府県 ?? "" },
    市区町村: { value: row.市区町村 ?? "" },
    住所: { value: row.住所 ?? "" },
    業種: { value: row.業種 ?? "" },
    // supply_point_22 / pd_number は FileMaker CSV にない（関電固有）→ 設定しない
  };
}

// ============================================================
// 値マッピング helpers
// ============================================================

/**
 * 個人法人区分 列の値を SoilCustomerType に正規化する。
 *
 * - '個人' / 'individual' → 'individual'
 * - '法人' / 'corporate' → 'corporate'
 * - その他 / 未指定 → null（呼出側で fallback 判定）
 */
function normalizeCustomerType(input: string | undefined): SoilCustomerType | null {
  const v = input?.trim() ?? "";
  if (v === "個人" || v === "individual") return "individual";
  if (v === "法人" || v === "corporate") return "corporate";
  return null;
}

/**
 * 規模 列の値を SoilBusinessSize に正規化する。
 *
 * - '極小' / 'micro' → 'micro'
 * - '小'  / 'small' → 'small'
 * - '中'  / 'medium' → 'medium'
 * - '大'  / 'large' → 'large'
 * - その他 / 未指定 → null
 */
function normalizeBusinessSize(input: string | undefined): SoilBusinessSize | null {
  const v = input?.trim() ?? "";
  if (v === "極小" || v === "micro") return "micro";
  if (v === "小" || v === "small") return "small";
  if (v === "中" || v === "medium") return "medium";
  if (v === "大" || v === "large") return "large";
  return null;
}

/**
 * ステータス 列の値を SoilListStatus に正規化する。
 * canonical 値（active / casecreated / churned / donotcall / merged）以外は 'active' にフォールバック。
 */
function normalizeStatus(input: string | undefined): SoilListStatus {
  const v = input?.trim() ?? "";
  switch (v) {
    case "active":
    case "casecreated":
    case "churned":
    case "donotcall":
    case "merged":
      return v as SoilListStatus;
    default:
      return "active";
  }
}

/**
 * 電話番号2 を SoilPhoneAlternate 配列に変換する。
 * 不正 / 空 → null。
 */
function buildPhoneAlternates(input: string | undefined): SoilPhoneAlternate[] | null {
  const normalized = normalizePhone(input);
  if (normalized == null) return null;
  return [{ number: normalized, type: "other" }];
}

// ============================================================
// 上位 transform: CSV 1 行 → SoilListInsert
// ============================================================

/**
 * FileMaker CSV 1 行を soil_lists 投入用 SoilListInsert に変換する（Phase 2 実装）。
 *
 * 流れ:
 *   1. csvRowToKintoneRecord で既存 transform 互換形に変換
 *   2. transformKintoneApp55ToSoilList で base SoilListInsert 生成
 *   3. Phase 2 固有の値で上書き:
 *      - source_system = 'filemaker-list2024'
 *      - source_channel = 'filemaker_export'
 *      - is_outside_list = false
 *      - list_no = 管理番号
 *      - source_record_id = 管理番号 ?? FileMakerレコードID
 *      - customer_type = 個人法人区分（明示優先、なければ base 判定維持）
 *      - phone_alternates = 電話番号2 由来
 *      - business_size = 規模 由来
 *      - status = ステータス 由来（既定 'active'）
 *
 * @param row FileMaker CSV 1 行
 * @returns SoilListInsert（soil_lists テーブル INSERT 入力）
 */
export function transformFileMakerCsvToSoilList(
  row: FileMakerCsvRow,
): SoilListInsert {
  const kintoneRecord = csvRowToKintoneRecord(row);
  const base = transformKintoneApp55ToSoilList(kintoneRecord);

  // list_no / source_record_id 解決
  const listNoRaw = row.管理番号?.trim() || null;
  const fmInternalId = row.FileMakerレコードID?.trim() || null;
  const sourceRecordId = listNoRaw ?? fmInternalId;

  // customer_type: 個人法人区分の明示があれば優先、なければ base 判定（法人名/代表者名による）を維持
  const explicitType = normalizeCustomerType(row.個人法人区分);
  const customerType: SoilCustomerType = explicitType ?? base.customer_type;

  // 法人時は name_kanji を法人名で再計算（base は detectKintoneCustomerType に依存するため
  // 個人法人区分が '法人' で 法人名 がある場合のみ上書き）
  const corpName = row.法人名?.trim() ?? "";
  const nameKanji =
    customerType === "corporate" && corpName !== ""
      ? corpName
      : base.name_kanji;

  return {
    ...base,
    source_system: "filemaker-list2024",
    source_channel: "filemaker_export",
    is_outside_list: false,
    list_no: listNoRaw,
    source_record_id: sourceRecordId,
    customer_type: customerType,
    name_kanji: nameKanji,
    phone_alternates: buildPhoneAlternates(row.電話番号2),
    business_size: normalizeBusinessSize(row.規模),
    status: normalizeStatus(row.ステータス),
  };
}
