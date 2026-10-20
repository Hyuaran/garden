import type { CallMetricsResponse } from "./call-metrics";
import type { LpContext } from "./lp-context.server";
import { isValidPhoneNumber, normalizePhoneNumber } from "./lp-funnel";
import type { LpCustomerRecord } from "./lp-kintone";

type TelemaEvent = { id: string; sales_id: string | null; flag: string; date: string; time: string | null };
type ReportCounts = { authorized: boolean; telema_events: TelemaEvent[]; confirmed_sales: string[]; phones: Array<{ circuit_id: number; number: string }> };

export function countReportTelema(events: TelemaEvent[], confirmedSales: string[]): NonNullable<CallMetricsResponse["reportTelema"]> {
  const acquired = new Map<string, string | null>();
  const confirmed = new Map<string, TelemaEvent>();
  const historical = new Set(confirmedSales);
  for (const event of events) {
    const sales = event.sales_id?.trim() || null;
    const key = sales ? `sales:${sales}` : `call:${event.id}`;
    if (event.flag === "獲得") acquired.set(key, sales);
    if (event.flag !== "前確OK" && event.flag !== "前確NG") continue;
    const current = confirmed.get(key);
    const time = `${event.date}T${event.time ?? "00:00:00"}`;
    const currentTime = current ? `${current.date}T${current.time ?? "00:00:00"}` : "";
    if (!current || time > currentTime || (time === currentTime && BigInt(event.id) > BigInt(current.id))) confirmed.set(key, event);
  }
  return {
    acquired: acquired.size,
    waiting: [...acquired.entries()].filter(([key, sales]) => !confirmed.has(key) && (!sales || !historical.has(sales))).length,
    ok: [...confirmed.values()].filter(e => e.flag === "前確OK").length,
    ng: [...confirmed.values()].filter(e => e.flag === "前確NG").length,
  };
}
const excludedStatuses = new Set(["対象外（現アナ等）", "対象外（契約不可）", "対象外（連絡つかず）"]);

// lp-funnel と同じ全電話項目・重複除外・最新作成日時による照合。
export function countReportCustomers(numbers: string[], records: LpCustomerRecord[] | null) {
  const unique = new Set(numbers.map(normalizePhoneNumber).filter(isValidPhoneNumber));
  if (records === null) return { handled: unique.size, effective: null };
  const byPhone = new Map<string, LpCustomerRecord>();
  for (const record of records) {
    if (record.status?.trim() === "重複") continue;
    for (const field of ["phone", "電話番号_ハイフンなし", "携帯番号_ハイフンなし", "架電連絡先"]) {
      const value = record.phones?.[field];
      const phone = normalizePhoneNumber(value);
      if (!isValidPhoneNumber(phone)) continue;
      const current = byPhone.get(phone);
      if (!current || (Date.parse(record.createdAt ?? "") || 0) >= (Date.parse(current.createdAt ?? "") || 0)) byPhone.set(phone, record);
    }
  }
  const excluded = [...unique].filter(phone => excludedStatuses.has(byPhone.get(phone)?.status?.trim() ?? "")).length;
  return { handled: unique.size, effective: unique.size - excluded };
}

export async function loadCallReportCounts(client: { rpc: (name: string, params: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> }, metrics: CallMetricsResponse, context: LpContext, asOf: Date): Promise<CallMetricsResponse> {
  const result = await client.rpc("system_call_report_counts", { p_from: metrics.from, p_to: metrics.to, p_as_of: asOf.toISOString(), p_lp_circuit_ids: context.lpCircuitIds });
  const counts = result.data as ReportCounts | null;
  if (result.error || !counts?.authorized || !Array.isArray(counts.telema_events) || !Array.isArray(counts.confirmed_sales) || !Array.isArray(counts.phones)) throw new Error("配信集計の取得に失敗しました");
  return {
    ...metrics,
    reportTelema: countReportTelema(counts.telema_events, counts.confirmed_sales),
    lp: metrics.lp ? { ...metrics.lp, businesses: metrics.lp.businesses.map(row => {
      const biz = context.lpScope?.find(b => b.bizCode === row.bizCode);
      const numbers = counts.phones.filter(p => biz?.circuitIds.includes(p.circuit_id)).map(p => p.number);
      return { ...row, reportCustomers: metrics.innovera?.hasRows ? countReportCustomers(numbers, context.recordsByApp.get(biz?.customerApp ?? 0) ?? null) : null };
    }) } : metrics.lp,
  };
}
