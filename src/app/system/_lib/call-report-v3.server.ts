import "server-only";
import { getAllRecords } from "@/lib/kintone/records";
import { loadPoints } from "@/app/soil/product-points/server";
import { creditApps, safeFetchCredit } from "../kanri/_lib/kanri-import.server";
import { reportEmployeeCount, reportOrders, reportPoints, reportRanking, telemaEmployees, type ReportEmployee } from "./call-report-v3";
import type { CallMetricsResponse } from "./call-metrics";

import { fetchKotDailySchedules, kotDailySchedulesPath, fetchKotEmployees, isKotUnavailable } from "@/app/root/_lib/kot-api";

export function kotReportHours(raw: unknown, date: string, employees: ReportEmployee[], codes: Map<string, string>) {
  if (!Array.isArray(raw)) throw new Error("KOT予定の形式不正");
  const targets = new Set(telemaEmployees(employees).map(e => e.kot_employee_id).filter(Boolean));
  if (!targets.size) throw new Error("テレマのKOTコードなし");
  const duration = (start: unknown, end: unknown) => {
    if (typeof start !== "string" || typeof end !== "string") throw new Error("KOT予定時間の形式不正");
    const minutes = (Date.parse(end) - Date.parse(start)) / 60000;
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error("KOT予定時間の形式不正");
    return minutes;
  };
  let minutes = 0;
  const seen = new Set<string>();
  for (const day of raw) {
    if (!day || typeof day.date !== "string" || !Array.isArray(day.dailySchedules)) throw new Error("KOT予定の形式不正");
    if (day.date !== date) throw new Error("KOT当日予定なし");
    for (const row of day.dailySchedules) {
      if (!row || typeof row.employeeKey !== "string" || row.date !== date) throw new Error("KOT予定の形式不正");
      const code = codes.get(row.employeeKey);
      if (!code || !targets.has(code) || seen.has(row.employeeKey)) continue;
      seen.add(row.employeeKey);
      if (row.clockInSchedule == null || row.clockInSchedule === "" || row.clockOutSchedule == null || row.clockOutSchedule === "") continue;
      if (!Array.isArray(row.startEndBreakSchedule)) throw new Error("KOT予定時間の形式不正");
      const breaks = row.startEndBreakSchedule.reduce((sum: number, rest: { start?: unknown; end?: unknown } | null) => {
        if (!rest) throw new Error("KOT予定時間の形式不正");
        return sum + duration(rest.start, rest.end);
      }, 0);
      const work = duration(row.clockInSchedule, row.clockOutSchedule) - breaks;
      if (work < 0) throw new Error("KOT予定時間の形式不正");
      minutes += work;
    }
  }
  return Math.round(minutes / 60);
}

type PointClient = Parameters<typeof loadPoints>[0];
export async function loadCallReportV3(client: PointClient, metrics: CallMetricsResponse, employees: ReportEmployee[]): Promise<CallMetricsResponse> {
  const warnings: string[] = [];
  let hours: number | null = null;
  let failure = "KING OF TIME の取得に失敗";
  try {
    const now = new Date();
    let readSaved: ((path: string) => Promise<unknown>) | undefined;
    if (isKotUnavailable(now)) {
      failure = "停止時間前の中継結果が不足または読み取り失敗";
      const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      const day = jst.toISOString().slice(0, 10);
      const cutoff = day + (jst.getUTCHours() < 10 ? "T08:30:00+09:00" : "T17:30:00+09:00");
      readSaved = async (path: string) => {
        const { data, error } = await client.from("system_relay_jobs")
          .select("result")
          .eq("kind", "kot")
          .eq("status", "done")
          .eq("request->>path", path)
          .gte("created_at", new Date(day + "T00:00:00+09:00").toISOString())
          .lt("created_at", new Date(cutoff).toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data) throw new Error("中継結果なし");
        return data.result;
      };
    }
    const kotEmployees = readSaved
      ? await readSaved(`/employees?date=${metrics.from}&includeResigner=true`)
      : await fetchKotEmployees({ date: metrics.from, includeResigner: true });

    failure = "KING OF TIME の結果の形式または予定時間が不正";
    if (!Array.isArray(kotEmployees) || kotEmployees.some(e => !e || typeof e.key !== "string" || typeof e.code !== "string")) {
      throw new Error("従業員一覧の形式不正");
    }
    const codes = new Map<string, string>(kotEmployees.map(e => [e.key, e.code]));
    const targets = new Set(telemaEmployees(employees).map(e => e.kot_employee_id).filter(Boolean));
    const divisions = new Set<string>();
    for (const person of kotEmployees) {
      if (!targets.has(person.code)) continue;
      // 所属の無い人（退職者など）は予定も無いので数えない
      if (typeof person.divisionCode !== "string" || !person.divisionCode) continue;
      divisions.add(person.divisionCode);
    }
    // Root のコードが KING OF TIME に無い人（在籍していない人など・2026-11-13 時点で 52 人中 24 人）は予定が無いので飛ばす。
    // 1 人でも無ければ全体を「-ｈ」にする作りだと毎回「-ｈ」になるため。
    failure = readSaved ? "停止時間前の予定の中継結果が不足または読み取り失敗" : "KING OF TIME の予定の取得または形式が不正";
    const schedules = await Promise.all([...divisions].map(async division => {
      const result = readSaved
        ? await readSaved(kotDailySchedulesPath(division, metrics.from))
        : await fetchKotDailySchedules(division, metrics.from);
      if (!Array.isArray(result)) throw new Error("KOT予定の形式不正");
      return result;
    }));
    failure = "KING OF TIME の予定の形式または予定時間が不正";
    hours = kotReportHours(schedules.flat(), metrics.from, employees, codes);
  } catch {
    console.warn(`[call-report-v3] 勤務時間を取得できませんでした: ${failure}`);
  }

  let points = "\n\n【テレマ全体】\n合計件数：-";
  try {
    const pointRows = await loadPoints(client);
    const orders = [] as ReturnType<typeof reportOrders>;
    try {
      const token = process.env.KINTONE_KANRI_CUSTOMER_TOKEN;
      if (!token) throw new Error("顧客一覧の鍵なし");
      const customer = await getAllRecords(10, token, `受注日 = "${metrics.from}"`, ["受注日", "事業名", "B_リスト名", "商材名区分2", "m_product", "商材ステータス"]);
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
