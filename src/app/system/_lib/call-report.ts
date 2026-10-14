import type { CallMetricsResponse, CallMetricsSummary, LpBusinessMetricRow } from "./call-metrics";

const JST_TIME_ZONE = "Asia/Tokyo";
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export function jstDateString(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseReportDate(value: unknown, now = new Date()): string {
  if (value === undefined) return jstDateString(now);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("日付はYYYY-MM-DD形式で指定してください");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("日付はYYYY-MM-DD形式で指定してください");
  }
  return value;
}

function formatDeliveryTime(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const date = new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00Z`);
  return `${get("year")}/${get("month")}/${get("day")}(${WEEKDAYS[date.getUTCDay()]}) ${get("hour")}:00`;
}

const rate = (value: number) => `${(value * 100).toFixed(1)}％`;

function formatShortJstTime(value: string | null | undefined) {
  if (!value) return "データなし";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "データなし";
  const parts = new Intl.DateTimeFormat("ja-JP", { timeZone: JST_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}`;
}

function formatLpNumber(value: number | null | undefined) {
  return value == null ? "-" : value.toLocaleString("ja-JP");
}

function lpTrafficTotal(metrics?: CallMetricsResponse) {
  return (metrics?.lp?.businesses ?? []).reduce((sum, row) => sum + (row.inbound ?? 0) + (row.outbound ?? 0), 0);
}

function lpLine(row: LpBusinessMetricRow) {
  return `${row.bizName}：着信${formatLpNumber(row.inbound)}（応答${formatLpNumber(row.answered)}・不在${formatLpNumber(row.missed)}）／発信${formatLpNumber(row.outbound)}／申込み${formatLpNumber(row.applications)}`;
}

function buildLpBlock(metrics?: CallMetricsResponse) {
  if (!metrics?.lp) return "";
  const stopped = metrics.innovera?.stopped ? `※INNOVERA 取込停止中（最終 ${formatShortJstTime(metrics.innovera.lastSyncAt)}）\n` : "";
  return `\n\n【WEBインバウンド】\n${stopped}${metrics.lp.businesses.map(lpLine).join("\n")}`;
}

export function buildCallReport(summary: CallMetricsSummary, now = new Date(), metrics?: CallMetricsResponse) {
  if (summary.totalCalls + lpTrafficTotal(metrics) === 0) {
    return { skipped: true as const, reason: "本日コール0件", text: null };
  }
  const noTelemaCalls = summary.totalCalls === 0;
  const text = `[info][title]テレマ コール集計ポータル 自動配信[/title]${formatDeliveryTime(now)}
https://garden-os.net/system/call-metrics

【本日】従業員${summary.employeeCount.toLocaleString("ja-JP")}名／総コール${summary.totalCalls.toLocaleString("ja-JP")}件
平均コール数：${noTelemaCalls ? "-" : `${Math.round(summary.averageCalls).toLocaleString("ja-JP")} 件`}
有効率：${noTelemaCalls ? "-" : rate(summary.effectiveRate)}
受注率：${noTelemaCalls ? "-" : rate(summary.acquiredRate)}（受注${summary.totalAcquired.toLocaleString("ja-JP")}件）
前確OK率：${noTelemaCalls ? "-" : rate(summary.preconfirmRate)}（前確OK${summary.totalOrders.toLocaleString("ja-JP")}件）${buildLpBlock(metrics)}
[/info]`;
  return { skipped: false as const, text };
}
