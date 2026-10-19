import type { CallMetricsResponse, CallMetricsSummary, LpBusinessMetricRow } from "./call-metrics";
import type { LpFunnelBusiness } from "./lp-funnel";

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

function lpTrafficTotal(metrics?: CallMetricsResponse) {
  return (metrics?.lp?.businesses ?? []).reduce((sum, row) => sum + (row.inbound ?? 0) + (row.outbound ?? 0), 0);
}

const formatLpRate = (value: number | null | undefined) => value == null ? "-" : `${(value * 100).toFixed(1)}％`;
const formatLpCountUnit = (value: number | null | undefined) => value == null ? "-" : `${value.toLocaleString("ja-JP")}件`;

// 事業ごとのまとまり（4〜5 行）。細かい内訳は添付の PDF で見る（東海林さん 2026-10-15「もう少しキュッと」）
// 受注は顧客一覧の受注日基準。前確待ち・分母・対象外は登録日（JST）基準。初回応答率・記録なしは従来の流れ図の集計を使う。
// 記録なしがあるときだけ最後に「⚠Kintone記録なし：n件」。見出し行【WEBインバウンド】は置かない
function lpBusinessBlock(row: LpBusinessMetricRow, funnel: LpFunnelBusiness | undefined) {
  const registered = row.registeredCounts;
  const denominator = registered?.denominator ?? 0;
  const lines = [
    `■${row.bizName}`,
    `発着信：${formatLpCountUnit(row.inbound == null || row.outbound == null ? null : row.inbound + row.outbound)}（着信${formatLpCountUnit(row.inbound)}／発信${formatLpCountUnit(row.outbound)}）`,
  ];
  lines.push(
    `初回応答率：${formatLpRate(funnel?.answerRate)}（応答${formatLpCountUnit(funnel?.answered)}／入電${formatLpCountUnit(funnel?.inbound)}）`,
    `受注率：${formatLpRate(denominator && row.customerOrders != null ? row.customerOrders / denominator : null)}（前確待ち${formatLpCountUnit(registered?.preconfirmWaiting)}／受注${formatLpCountUnit(row.customerOrders)}）`,
    `対象外率：${formatLpRate(denominator ? registered!.excluded / denominator : null)}`,
  );
  if ((funnel?.noRecord ?? 0) > 0) lines.push(`⚠Kintone記録なし：${formatLpCountUnit(funnel!.noRecord)}`);
  return lines.join("\n");
}

function buildLpBlock(metrics?: CallMetricsResponse) {
  if (!metrics?.lp) return "";
  const stopped = metrics.innovera?.stopped ? `※INNOVERA 取込停止中（最終 ${formatShortJstTime(metrics.innovera.lastSyncAt)}）\n` : "";
  const funnelByBiz = new Map((metrics.lpFunnel?.businesses ?? []).map((biz) => [biz.bizCode, biz]));
  const blocks = metrics.lp.businesses.map((row) => lpBusinessBlock(row, funnelByBiz.get(row.bizCode)));
  // 顧客一覧の受注で、リスト名 WEB_〇〇 の〇〇が事業の名前と違うもの（数え漏れを出さないため最後に知らせる）
  const unmatched = (metrics.lpUnmatchedOrders ?? []).map((o) => `${o.listName} ${formatLpCountUnit(o.count)}`);
  const warn = unmatched.length ? `\n\n⚠事業に結びつかない受注（リスト名を確認）：${unmatched.join("、")}` : "";
  return `\n\n${stopped}${blocks.join("\n\n")}${warn}`;
}

export function buildCallReport(summary: CallMetricsSummary, now = new Date(), metrics?: CallMetricsResponse) {
  // 0 件スキップ＝テレマの総コール＋LP の着信＋LP の発信＋フォーム受付数が 0 のときだけ（v1.7）
  if (summary.totalCalls + lpTrafficTotal(metrics) + (metrics?.lpFormCount ?? 0) === 0) {
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
