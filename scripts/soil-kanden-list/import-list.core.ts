import { normalizeKanriNo } from "../../src/lib/leaf-kanden/kanri-no";
import { csvRecords } from "../leaf-kanden-orders/import-fm-csv.core";

const textFields = {
  list_name: "リスト名",
  customer_no: "お客様番号",
  customer_name: "現契約名義_漢字",
  customer_kana: "現契約名義_カナ",
  postal_code: "現使用場所住所_〒",
  address1: "現使用場所住所1",
  address2: "現使用場所住所2",
  phone1: "電話番号1",
  phone2: "電話番号2",
  mobile: "携帯番号",
  billing_postal_code: "現請求先住所_〒",
  billing_address1: "現請求先住所1",
  billing_address2: "現請求先住所2",
  industry: "業種",
  usage_code: "用途コード",
  contract_type: "契約種別",
  capacity: "契約容量_従Ｂ",
  power_contract: "動力契約",
  power_capacity: "契約容量_動力",
  hapie: "はぴeみる電",
  annual_usage: "年間合計使用量_電灯",
  monthly_usage: "月間平均使用量_電灯",
  departure_provider: "離脱先",
  departure_period: "離脱時期",
  demand: "デマンド",
  monthly_power_usage: "月間平均使用量_動力",
  current_charge: "現料金",
  new_charge: "なっトクでんき変更後",
  savings: "なっトクでんきメリット額",
  electricity_offer: "電気単独提案可否",
  electricity_charge: "電気単独変更後",
  electricity_savings: "電気単独メリット額",
  gas_contract: "関電ガス契約",
  no_appointments: "アポ禁",
  no_electricity_appointments: "電気アポ禁",
} as const;

const dateFields = {
  supply_started_on: "需要開始年月日",
  dm_sent_on: "DM発送日",
  usage_on: "電気使用量_日付",
  fm_created_on: "作成日",
  fm_updated_on: "修正日",
} as const;

const usageFields = Array.from({ length: 12 }, (_, index) => `電気使用量${index + 1}`);
export const listHeaders = ["ROWID", "管理番号", ...Object.values(textFields), ...Object.values(dateFields), ...usageFields];

function fileMakerDate(value: string | undefined) {
  const parts = value?.trim().normalize("NFKC").match(/^([1-9]\d{3})[-/]([0-9]{1,2})[-/]([0-9]{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (!parts) return null;
  const date = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
  const time = Date.parse(date);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? date : null;
}

export function* readListCsv(content: string) {
  const records = csvRecords(content);
  const headers = records.next().value?.map(header => header.trim());
  if (!headers || new Set(headers).size !== headers.length || !listHeaders.every(header => headers.includes(header))) {
    throw new Error("CSV の見出しが不正です。");
  }
  let line = 1;
  for (const values of records) {
    line++;
    if (values.length !== headers.length) throw new Error(`CSV の ${line} レコード目の項目数が不正です。`);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    const rowId = row.ROWID.trim();
    if (!/^\d+$/.test(rowId)) throw new Error(`CSV の ${line} レコード目の ROWID が不正です。`);
    const value = (header: string) => row[header]?.trim() || null;
    yield {
      fm_rowid: rowId.replace(/^0+(?=\d)/, ""),
      kanri_no_raw: row["管理番号"] || null,
      kanri_no: normalizeKanriNo(row["管理番号"]),
      ...Object.fromEntries(Object.entries(textFields).map(([key, header]) => [key, value(header)])),
      ...Object.fromEntries(Object.entries(dateFields).map(([key, header]) => [key, fileMakerDate(row[header])])),
      supply_point: value("供給地点特定番号"),
      electricity_usage: usageFields.map(value),
    };
  }
}

export type ListRow = ReturnType<typeof readListCsv> extends Generator<infer Row> ? Row : never;
