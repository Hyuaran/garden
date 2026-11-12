import "server-only";
import { getAllRecords } from "@/lib/kintone/records";
import { loadPoints } from "@/app/soil/product-points/server";
import { creditApps, safeFetchCredit } from "../kanri/_lib/kanri-import.server";
import { reportEmployeeCount, reportHoursFromMetrics, reportOrders, reportPoints, reportRanking, telemaEmployees, type ReportEmployee } from "./call-report-v3";
import type { CallMetricsResponse } from "./call-metrics";

type DailyActual = { date?: string; employeeKey: string; employeeCode?: string; workMinutes?: number };
export function kotReportHours(raw: unknown, date: string, employees: ReportEmployee[], codes: Map<string, string>) {
  const days = Array.isArray(raw) ? raw : [raw];
  const rows: DailyActual[] = days.flatMap(day => day && typeof day === "object" && "dailyWorkings" in day
    ? day.date === date && Array.isArray(day.dailyWorkings) ? day.dailyWorkings : []
    : day && typeof day === "object" && day.date === date && "employeeKey" in day ? [day] : []);
  if (!rows.length) throw new Error("KOT当日実績なし");
  const targets = new Set(telemaEmployees(employees).map(e => e.kot_employee_id).filter(Boolean));
  if (!targets.size) throw new Error("テレマのKOTコードなし");
  let minutes = 0;
  for (const row of rows) {
    const code = row.employeeCode ?? codes.get(row.employeeKey);
    if (!code || !targets.has(code)) continue;
    if (typeof row.workMinutes !== "number" || !Number.isFinite(row.workMinutes) || row.workMinutes < 0) throw new Error("KOT実績時間なし");
    minutes += row.workMinutes;
  }
  return Math.round(minutes / 60);
}

type PointClient = Parameters<typeof loadPoints>[0];
export async function loadCallReportV3(client: PointClient, metrics: CallMetricsResponse, employees: ReportEmployee[]): Promise<CallMetricsResponse> {
  const warnings: string[] = [];
  const hours = reportHoursFromMetrics(metrics.employeeMetrics, employees);

  let points = "\n\n【テレマ全体】\n合計件数：-";
  try {
    const pointRows = await loadPoints(client);
    const orders = [] as ReturnType<typeof reportOrders>;
    try {
      const token = process.env.KINTONE_KANRI_CUSTOMER_TOKEN;
      if (!token) throw new Error("顧客一覧の鍵なし");
      const customer = await getAllRecords(10, token, `受注日 = "${metrics.from}"`, ["受注日", "事業名", "B_リスト名", "商材名区分2", "商材ステータス"]);
      orders.push(...reportOrders(customer, metrics.from));
    } catch { warnings.push("⚠顧客一覧を読めませんでした（ポイントは読めた分のみ）"); }
    const credit = await Promise.all(creditApps().map(app => safeFetchCredit(app, metrics.from, { report: true })));
    for (const outcome of credit) {
      if (!outcome.ok) warnings.push(`⚠クレカのアプリ ${outcome.sourceApp} を読めませんでした`);
      else orders.push(...reportOrders(outcome.records, metrics.from, true));
    }
    const aggregated = reportPoints(orders, pointRows);
    points = aggregated.text;
    warnings.push(...aggregated.warnings);
  } catch { warnings.push("⚠テレマ全体のポイントを集計できませんでした"); }
  return { ...metrics, reportV3: { hours, employeeCount: reportEmployeeCount(metrics.employeeMetrics, employees), ranking: reportRanking(metrics.employeeMetrics), points, warnings } };
}
