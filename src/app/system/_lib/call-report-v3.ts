import { CHANNELS, REPORT_GROUPS, pointFor, roundPoints, resolveChannel, type Channel, type Order as PointOrder, type PointRow } from "@/lib/product-points";
import type { KintoneRecord } from "@/lib/kintone/records";
import { fieldValue } from "../kanri/_lib/kanri-core";
import type { EmployeeCallMetricRow } from "./call-metrics";

export type ReportEmployee = {
  employee_id?: string | null;
  name?: string | null;
  filemaker_employee_name?: string | null;
  current_team?: string | null;
  kot_employee_id?: string | null;
};
export type CallReportV3 = {
  employeeCount: number;
  hours: number | null;
  ranking: string;
  points: string;
  warnings: string[];
};
const teams = new Set(["宮永チーム", "小泉チーム", "石原チーム", "新人チーム"]);
const normalizedName = (name: string | null | undefined) => (name ?? "").replace(/[\s　]/g, "");
export const surname = (name: string) => name.trim().split(/[\s　]+/)[0];
export function telemaEmployees(employees: ReportEmployee[]) {
  return employees.filter(e => teams.has(e.current_team ?? "") && !normalizedName(e.name).startsWith("上田"));
}
export function reportEmployeeCount(rows: EmployeeCallMetricRow[], employees: ReportEmployee[]) {
  const names = new Set(rows.filter(r => r.callCount > 0).map(r => normalizedName(r.employeeName)));
  return telemaEmployees(employees).filter(e => names.has(normalizedName(e.name)) || names.has(normalizedName(e.filemaker_employee_name))).length;
}
export function reportRanking(rows: EmployeeCallMetricRow[]) {
  const lines: string[] = [];
  for (const [label, key] of [["クローザー", "acquiredCount"], ["トス", "tossCount"]] as const) {
    const max = Math.max(0, ...rows.map(r => r[key]));
    if (!max) continue;
    const names = [...new Set(rows.filter(r => r[key] === max).map(r => `${surname(r.employeeName)}さん`))];
    lines.push(`${label}：${max}件 ${names.join("・")}`);
  }
  return lines.length ? `\n\n当日獲得ランキング1位\n${lines.join("\n")}` : "";
}

// キャンセルを含める決定になった場合はここだけ切り替える。
export const EXCLUDE_CANCELLED_REPORT_ORDERS = true;
type Order = PointOrder & { kind: "today" | "tachiage" };
const text = (r: KintoneRecord, key: string) => String(fieldValue(r, key) ?? "").trim();
export function reportOrders(records: KintoneRecord[], date: string, credit = false): Order[] {
  return records.flatMap(r => {
    const orderDate = credit ? text(r, "日付_4") || text(r, "紹介日") : text(r, "実績日");
    if (orderDate !== date || (!credit && text(r, "実績可否") !== "可")) return [];
    const order = extractPointOrder(r, orderDate, credit);
    if (!order?.channel) return [];
    const launchDate = text(r, "立ち上げ日");
    const kind = !credit && launchDate && launchDate === orderDate ? "tachiage" : "today";
    return [{ ...order, kind }];
  });
}

// 日付の絞り込みは呼び出し側で行う。獲得方法が不明な受注も返す。
export function extractPointOrder(r: KintoneRecord, orderDate: string, credit = false): PointOrder | null {
    if (EXCLUDE_CANCELLED_REPORT_ORDERS && text(r, "商材ステータス") === "キャンセル") return null;
    // 管理表のクレカには事業名相当の「文字列__1行__14」がある。
    const business = text(r, "事業名") || (credit ? text(r, "文字列__1行__14") : "");
    const list = text(r, "B_リスト名") || text(r, "リスト名");
    const hasChannelField = ["事業名", "文字列__1行__14", "B_リスト名", "リスト名"].some(k => k in r);
    const channel = credit && !hasChannelField ? "hakuchi" : resolveChannel({ 事業名: business || (credit && list ? "自社" : ""), リスト名: list });
    // 顧客一覧は「商材区分2（マスタ）」（m_product）も持つ。商材名区分2 で表に無いとき（例：タイプなしの「au光プラス」）だけ使う
    const masterProduct = credit ? "" : text(r, "m_product");
    return { productName: credit ? text(r, "ドロップダウン_12") || text(r, "商材名区分2") : text(r, "商材名区分2") || masterProduct, masterProduct, orderDate, channel };
}
export function reportPoints(orders: Order[], rows: PointRow[]) {
  let total = 0;
  const missing = new Map<string, number>();
  function aggregate(channel: Channel, kind: Order["kind"], prefix = "") {
    let subtotal = 0;
    const groups = new Map<string, number>();
    for (const order of orders.filter(o => o.channel === channel && o.kind === kind)) {
      const row = pointFor(rows, order) ?? (order.masterProduct ? pointFor(rows, { ...order, productName: order.masterProduct }) : null);
      if (!row) { missing.set(order.productName, (missing.get(order.productName) ?? 0) + 1); continue; }
      subtotal = roundPoints(subtotal + row.total_points);
      groups.set(row.report_group, roundPoints((groups.get(row.report_group) ?? 0) + row.total_points));
    }
    const details = Object.entries(REPORT_GROUPS).flatMap(([key, label]) => (groups.get(key) ?? 0) ? [`${prefix}${label}${groups.get(key)!.toFixed(1)}`] : []);
    return { subtotal, details };
  }
  const channels = Object.keys(CHANNELS) as Channel[];
  const formatLine = (label: string, subtotal: number, details: string[]) =>
    `${label}：${subtotal.toFixed(1)}P${details.length ? `（${details.join("／")}）` : ""}`;
  const buckets = channels.flatMap(channel => {
    const { subtotal, details } = aggregate(channel, "today");
    total = roundPoints(total + subtotal);
    return subtotal ? [formatLine(CHANNELS[channel], subtotal, details)] : [];
  });
  let launchTotal = 0;
  const launchDetails = channels.flatMap(channel => {
    const { subtotal, details } = aggregate(channel, "tachiage", `${CHANNELS[channel]}-`);
    launchTotal = roundPoints(launchTotal + subtotal);
    return details;
  });
  total = roundPoints(total + launchTotal);
  if (launchTotal) buckets.push(formatLine("立ち上げ", launchTotal, launchDetails));
  return {
    text: `\n\n【テレマ全体】\n${[`合計件数：${total.toFixed(1)}P`, ...buckets].join("\n")}`,
    warnings: [...missing].map(([name, count]) => `⚠ポイント表に無い商材：${name} ${count}件`),
  };
}
