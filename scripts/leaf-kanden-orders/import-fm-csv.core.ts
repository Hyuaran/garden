import { normalizeKanriNo } from "../../src/lib/leaf-kanden/kanri-no";

const textFields = {
  payment_confirmed: "入金確認",
  fc_result: "FC結果",
  progress: "進捗",
  acquisition: "区分_奪還囲込",
  acquisition_method: "獲得手法",
  order_method: "受注手法",
  sales_name: "受注者",
  clerk_name: "事務担当者",
  list_name: "リスト名",
  contract_type: "契約種別",
  power_apply: "動力申込",
  plan: "申込ﾌﾟﾗﾝ",
  phone: "電話番号1",
  denki_customer_no: "電灯_お客様番号",
  denki_supply_point: "電灯_供給地点特定番号",
  douryoku_customer_no: "動力_お客様番号",
  douryoku_supply_point: "動力_供給地点特定番号",
  gas_customer_no: "ガス_お客様番号",
  gas_supply_point: "ガス_供給地点特定番号",
  note: "備考",
} as const;

const dateFields = {
  ordered_on: "受注日",
  entered_on: "エントリー日",
  specs_on: "諸元回収日",
  mailed_on: "申込Excel送付日",
  invoice_sent_on: "請求Excel送付日",
  cancelled_on: "取消日",
} as const;

type CsvRow = Record<string, string>;

function value(row: CsvRow, field: string) {
  return row[field]?.trim() || null;
}

function date(input: string | null) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input) || input.startsWith("0000")) return null;
  const time = Date.parse(input);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === input ? input : null;
}

function timestamp(input: string | null) {
  if (!input || !date(input.slice(0, 10))) return null;
  return Number.isFinite(Date.parse(input)) ? input : null;
}

function numeric(input: string | null) {
  const decimal = input?.normalize("NFKC").replace(/,/g, "");
  return decimal && /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(decimal) ? decimal : null;
}

function address(row: CsvRow, prefix: string) {
  return [value(row, prefix + "1"), value(row, prefix + "2")].join("") || null;
}

export function convertOrder(row: CsvRow) {
  const fmPk = numeric(value(row, "主キー"));
  if (!fmPk) throw new Error("主キーが空欄または数値ではありません。");
  const raw = row["管理番号"] || null;
  return {
    ...Object.fromEntries(Object.entries(textFields).map(([column, field]) => [column, value(row, field)])),
    ...Object.fromEntries(Object.entries(dateFields).map(([column, field]) => [column, date(value(row, field))])),
    fm_pk: fmPk,
    kanri_no: raw ? normalizeKanriNo(raw) : null,
    kanri_no_raw: raw,
    customer_name: value(row, "新契約者名義_漢字") ?? value(row, "現契約名義_漢字"),
    customer_kana: value(row, "新契約者名義_カナ") ?? value(row, "現契約名義_カナ"),
    postal_code: value(row, "新使用場所住所_〒") ?? value(row, "現使用場所住所_〒"),
    address: address(row, "新使用場所住所") ?? address(row, "現使用場所住所"),
    billing_amount: numeric(value(row, "請求金額")),
    fm_created_at: timestamp(value(row, "作成日")),
    fm_updated_at: timestamp(value(row, "修正日")),
  };
}

/** 引用符内の改行・カンマと、二重の引用符を扱う。 */
export function parseOrderCsv(content: string): CsvRow[] {
  const input = content.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  function finishField() {
    record.push(field);
    field = "";
    closedQuote = false;
  }
  function finishRecord() {
    finishField();
    if (record.length > 1 || record[0]) records.push(record);
    record = [];
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[index + 1] === '"') {
        field += '"';
        index++;
      } else {
        quoted = false;
        closedQuote = true;
      }
    } else if (char === ",") {
      finishField();
    } else if (char === "\n" || char === "\r") {
      finishRecord();
      if (char === "\r" && input[index + 1] === "\n") index++;
    } else if (closedQuote || (char === '"' && field)) {
      throw new Error(`CSV の ${records.length + 1} レコード目の引用符が不正です。`);
    } else if (char === '"') {
      quoted = true;
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error("CSV の引用符が閉じていません。");
  if (record.length || field || closedQuote) finishRecord();

  const headers = records.shift()?.map(header => header.trim());
  if (!headers?.includes("主キー") || new Set(headers).size !== headers.length) {
    throw new Error("CSV の見出しが不正です。");
  }
  return records.map((values, index) => {
    if (values.length !== headers.length) throw new Error(`CSV の ${index + 2} レコード目の項目数が不正です。`);
    return Object.fromEntries(headers.map((header, column) => [header, values[column]]));
  });
}
