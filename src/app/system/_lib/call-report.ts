import type { CallMetricsSummary } from "./call-metrics";

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
  return `${get("year")}/${get("month")}/${get("day")}(${WEEKDAYS[date.getUTCDay()]}) ${get("hour")}:${get("minute")}`;
}

const rate = (value: number) => `${(value * 100).toFixed(1)}％`;

export function buildCallReport(summary: CallMetricsSummary, now = new Date()) {
  if (summary.totalCalls === 0) {
    return { skipped: true as const, reason: "本日コール0件", text: null };
  }
  const text = `[info][title]テレマ コール集計ポータル 自動配信[/title]
${formatDeliveryTime(now)}
https://garden-os.net/system/call-metrics

【本日】従業員${summary.employeeCount.toLocaleString("ja-JP")}名／総コール${summary.totalCalls.toLocaleString("ja-JP")}件
平均コール数：${Math.round(summary.averageCalls).toLocaleString("ja-JP")} 件
有効率：${rate(summary.effectiveRate)}
受注率：${rate(summary.orderRate)}（受注${summary.totalOrders.toLocaleString("ja-JP")}件／獲得${summary.totalAcquired.toLocaleString("ja-JP")}件）
[/info]`;
  return { skipped: false as const, text };
}
