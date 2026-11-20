import { win32 } from "node:path";
import { normalizeKanriNo } from "../../src/lib/leaf-kanden/kanri-no";

export const STATEMENT_SHEET = "業務委託（囲い込み＿奪還）";
const HEADERS = {
  pd_row_no: "No.", sales_name: "獲得担当 フルネーム", sales_method: "営業手法",
  sent_on: "データー送信日 申込書発送日", customer_no: "門標※", kanri_no_raw: "管理番号",
  list_flag: "リスト", customer_name: "契約名義", customer_kana: "契約名義（ｶﾅ）",
  acquisition: "囲込 奪還", item: "契約品目", amount: "コミッション 請求額", note: "備考",
} as const;

function cellValue(value: unknown): unknown {
  if (typeof value !== "object" || value === null || value instanceof Date) return value;
  if ("result" in value) return cellValue(value.result);
  if ("richText" in value && Array.isArray(value.richText)) return value.richText.map(part => part.text).join("");
  if ("text" in value) return value.text;
  return null;
}

function text(value: unknown): string | null {
  const plain = cellValue(value);
  return typeof plain === "string" || typeof plain === "number" ? String(plain).trim() || null : null;
}

export function isStatementFile(path: string): boolean {
  const name = win32.basename(path);
  return /\.xlsx$/i.test(name) && name.includes("プロディライト") && name.includes("支払詳細")
    && !/暫定|削除候補/.test(name) && !name.startsWith("~$");
}

export function statementMonth(path: string): string | null {
  const match = win32.basename(path).normalize("NFKC").match(/(?:^|\D)([1-9]\d{3})\.(0?[1-9]|1[0-2])月/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}` : null;
}

type Column = keyof typeof HEADERS;
export type StatementColumns = Record<Column, number>;
const headerKey = (value: unknown) => text(value)?.normalize("NFKC").replace(/\s+/g, "").toLowerCase();

export function statementColumns(cells: readonly unknown[]): StatementColumns {
  const keys = cells.map(headerKey);
  return Object.fromEntries(Object.entries(HEADERS).map(([field, label]) => {
    const index = keys.indexOf(headerKey(label));
    if (index < 0) throw new Error(`明細の見出し「${label}」がありません。`);
    return [field, index];
  })) as StatementColumns;
}

function dateCell(value: unknown, date1904: boolean): string | null {
  const plain = cellValue(value);
  if (plain == null || (typeof plain === "string" && !plain.trim())) return null;
  if (plain instanceof Date) return plain.toISOString().slice(0, 10);
  if (typeof plain === "number" && plain >= 0 && plain <= 2957003) {
    const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, plain < 60 ? 31 : 30);
    return new Date(epoch + Math.floor(plain) * 86400000).toISOString().slice(0, 10);
  }
  const parts = text(plain)?.normalize("NFKC").match(/^([1-9]\d{3})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/);
  if (parts) {
    const iso = `${parts[1]}-${parts[2].padStart(2, "0")}-${parts[3].padStart(2, "0")}`;
    const date = new Date(iso);
    if (Number.isFinite(+date) && date.toISOString().slice(0, 10) === iso) return iso;
  }
  throw new Error("データー送信日・申込書発送日が不正です。");
}

function amountCell(value: unknown): number | null {
  const raw = text(value)?.normalize("NFKC").replace(/[\s,¥円]/g, "").replace(/^[△▲−]/, "-")
    .replace(/^\((\d+)\)$/, "-$1");
  if (!raw) return null;
  const amount = Number(raw);
  if (!/^[+-]?\d+$/.test(raw) || !Number.isInteger(amount) || amount < -2147483648 || amount > 2147483647) {
    throw new Error("コミッション請求額が不正です。");
  }
  return amount;
}

export function parseStatementRow(cells: readonly unknown[], columns: StatementColumns, month: string, file: string, date1904 = false) {
  const pdRowNo = text(cells[columns.pd_row_no]);
  if (!pdRowNo || /^(?:合計|小計|総計|総合計)$/.test(pdRowNo)) return null;
  const fields = Object.fromEntries(Object.keys(HEADERS).map(key => [key, text(cells[columns[key as Column]])])) as
    Record<Exclude<Column, "pd_row_no" | "sent_on" | "amount">, string | null>;
  return {
    ...fields, pd_row_no: pdRowNo.normalize("NFKC"), statement_month: month, source_file: win32.basename(file),
    kanri_no: fields.kanri_no_raw ? normalizeKanriNo(fields.kanri_no_raw) : null,
    sent_on: dateCell(cells[columns.sent_on], date1904), amount: amountCell(cells[columns.amount]),
  };
}

export type StatementRow = NonNullable<ReturnType<typeof parseStatementRow>>;
export type MatchOrder = {
  id: string;
  kanri_no_raw: string | null;
  ordered_on: string | null;
  denki_customer_no: string | null;
  douryoku_customer_no: string | null;
  gas_customer_no: string | null;
  contract_type: string | null;
  power_apply: string | null;
  has_denki: boolean | null;
  has_douryoku: boolean | null;
  has_gas: boolean | null;
};

type Service = "denki" | "douryoku" | "gas";
const powerItem = /動力|低圧電力/;

export function paymentService(item: string | null, rawNumber: string | null): Service {
  const value = item?.normalize("NFKC").trim() ?? "";
  if (powerItem.test(value) || value.endsWith("動") || /(?:動力|低圧電力|動)$/.test(rawNumber?.trim() ?? "")) {
    return "douryoku";
  }
  return value.includes("関電ガスのみ") ? "gas" : "denki";
}

export function paymentKanriKey(raw: string | null): string | null {
  const number = raw?.normalize("NFKC").trim().replace(/(?:動力|低圧電力|動)$/, "").trim();
  const match = number?.match(/^(?:PD)?\s*(\d+)(?:\s*\(\s*(\d+)\s*\))?$/i);
  if (!match) return null;
  const base = match[1].replace(/^0+(?=\d)/, "");
  return match[2] ? base + "-" + match[2] : base;
}

function customerKey(raw: string | null): string {
  return raw?.normalize("NFKC").replace(/\D/g, "") ?? "";
}

function hasService(order: MatchOrder, service: Service): boolean {
  if (order[`has_${service}`] === true || customerKey(order[`${service}_customer_no`])) return true;
  const contract = order.contract_type?.normalize("NFKC") ?? "";
  if (service === "douryoku") {
    const power = order.power_apply?.normalize("NFKC").replace(/\s/g, "") ?? "";
    return powerItem.test(contract)
      || /^(?:あり|有り?|有り?\(.*\)|申込あり|申込有|申込|申し込み|動力|動力あり|○|〇|1)$/.test(power);
  }
  if (service === "gas") return /ガス/.test(contract);
  return /電灯|電気|eおとく|なっトクでんき/i.test(contract);
}

export function indexPaymentOrders(orders: readonly MatchOrder[]) {
  const byCustomer: Record<Service, Map<string, MatchOrder[]>> = { denki: new Map(), douryoku: new Map(), gas: new Map() };
  const byNumber = new Map<string, MatchOrder[]>();
  function add(index: Map<string, MatchOrder[]>, key: string | null, order: MatchOrder) {
    if (!key) return;
    const group = index.get(key);
    if (group) group.push(order);
    else index.set(key, [order]);
  }

  for (const order of orders) {
    add(byNumber, paymentKanriKey(order.kanri_no_raw), order);
    for (const service of ["denki", "douryoku", "gas"] as const) {
      add(byCustomer[service], customerKey(order[`${service}_customer_no`]), order);
    }
  }
  return { byCustomer, byNumber };
}

function latestOrder(orders: readonly MatchOrder[], sentOn: string | null): MatchOrder | null {
  if (!sentOn) return null;
  let latestDate = "";
  let latest: MatchOrder | null = null;
  for (const order of orders) {
    const date = order.ordered_on;
    if (!date || date > sentOn || date < latestDate) continue;
    latest = date === latestDate ? null : order;
    latestDate = date;
  }
  return latest;
}

export function matchPayment(
  row: Pick<StatementRow, "customer_no" | "kanri_no_raw" | "item" | "sent_on">,
  orders: ReturnType<typeof indexPaymentOrders>,
) {
  function unmatched(reason: string) {
    return { order_id: null, match_note: reason, matched_by: null, narrowed_by_date: false };
  }
  function resolve(candidates: MatchOrder[], matched_by: "customer" | "number", reason: string) {
    if (candidates.length === 1) {
      return { order_id: candidates[0].id, match_note: null, matched_by, narrowed_by_date: false };
    }
    const latest = latestOrder(candidates, row.sent_on);
    if (latest) return { order_id: latest.id, match_note: null, matched_by, narrowed_by_date: true };
    return unmatched(reason);
  }

  const service = paymentService(row.item, row.kanri_no_raw);
  const number = paymentKanriKey(row.kanri_no_raw);
  const sameCustomer = orders.byCustomer[service].get(customerKey(row.customer_no)) ?? [];
  if (sameCustomer.length) {
    const sameBoth = number ? sameCustomer.filter(order => paymentKanriKey(order.kanri_no_raw) === number) : [];
    const candidates = sameBoth.length ? sameBoth : sameCustomer;
    return resolve(candidates, "customer", "同じ門標の受注を 1 件に絞れない");
  }

  if (!number) return unmatched("管理番号なし・不正");
  const sameNumber = orders.byNumber.get(number);
  if (!sameNumber) return unmatched("同じ管理番号の受注なし");
  const matching = sameNumber.filter(order => hasService(order, service));
  if (!matching.length) return unmatched("契約品目が合う受注なし");
  return resolve(matching, "number", "同じ管理番号で契約品目が合う受注を 1 件に絞れない");
}
