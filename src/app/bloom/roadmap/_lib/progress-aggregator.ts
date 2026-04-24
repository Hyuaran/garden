/**
 * Roadmap 画面用 集計ユーティリティ
 *
 * bloom_roadmap_entries の配列を画面表示向けに再構成する純粋関数群。
 * DB 呼び出しはしない（_lib/roadmap-queries.ts で取得したデータを渡す）。
 */

import type {
  BannerSeverity,
  RoadmapEntry,
  RoadmapEntryKind,
} from "../../_types/roadmap-entry";

export type MonthBucket = {
  month: string;                   // "M1"..."M8"
  entries: RoadmapEntry[];
  avgProgressPct: number;          // バケット内の progress_pct の平均（null 除外）
};

/** 全体進捗（phase / module エントリの progress_pct を平均化） */
export function calculateOverallProgress(entries: RoadmapEntry[]): number {
  const pcts = entries
    .filter((e) => e.kind === "phase" || e.kind === "module")
    .map((e) => e.progress_pct)
    .filter((v): v is number => typeof v === "number");
  if (pcts.length === 0) return 0;
  const sum = pcts.reduce((a, b) => a + b, 0);
  return Math.round(sum / pcts.length);
}

/**
 * target_month でバケット化して M1-M8 順にソート。
 * target_month が null のエントリは "未定" バケットに集約。
 */
export function aggregateByMonth(
  entries: RoadmapEntry[],
  kinds: RoadmapEntryKind[] = ["phase", "milestone", "module"],
): MonthBucket[] {
  const filtered = entries.filter((e) => kinds.includes(e.kind));
  const map = new Map<string, RoadmapEntry[]>();
  for (const e of filtered) {
    const key = e.target_month ?? "未定";
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  const buckets: MonthBucket[] = [];
  for (const [month, arr] of map.entries()) {
    const pcts = arr
      .map((e) => e.progress_pct)
      .filter((v): v is number => typeof v === "number");
    const avg =
      pcts.length === 0
        ? 0
        : Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    buckets.push({ month, entries: arr, avgProgressPct: avg });
  }
  return buckets.sort((a, b) => monthOrder(a.month) - monthOrder(b.month));
}

function monthOrder(month: string): number {
  const match = month.match(/^M(\d+)$/);
  if (match) return parseInt(match[1], 10);
  return 999; // "未定" 等は末尾
}

/** 重大度ランク（AnnouncementBanner / RiskCardList 共通） */
export function severityRank(severity: BannerSeverity | null): number {
  switch (severity) {
    case "critical": return 3;
    case "warn": return 2;
    case "info": return 1;
    default: return 0;
  }
}

/** 重大度が高い順 */
export function sortBySeverityDesc(entries: RoadmapEntry[]): RoadmapEntry[] {
  return [...entries].sort(
    (a, b) => severityRank(b.banner_severity) - severityRank(a.banner_severity),
  );
}
