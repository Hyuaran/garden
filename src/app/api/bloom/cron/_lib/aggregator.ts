/**
 * Cron 配信用の集計クエリ群
 *
 * service role key で読み取り（RLS バイパス）。
 * 集計対象:
 *   - bloom_daily_logs (当日 / 直近 7 日)
 *   - bloom_roadmap_entries (phase / module)
 *   - bloom_project_progress (先週比較)
 *   - bloom_monthly_digests (月次配信用)
 */

import { getSupabaseAdmin } from "../../../../../lib/supabase/admin";
import type { DailyLog, PlannedItem } from "../../../../../app/bloom/_types/daily-log";
import type {
  MonthlyDigest,
  MonthlyDigestStatus,
} from "../../../../../app/bloom/_types/monthly-digest";
import type { RoadmapEntry } from "../../../../../app/bloom/_types/roadmap-entry";

// ---- 日付ユーティリティ ------------------------------------------------

export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(d.getDate() + days);
  return next;
}

export function startOfMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// ---- daily 集計 ---------------------------------------------------------

export type DailyAggregate = {
  doneCountToday: number;
  highlights: string[];
  tomorrowItems: string[];
  overallPct: number;
  diffPctWeek: number;
};

export async function aggregateDaily(now: Date): Promise<DailyAggregate> {
  const supabase = getSupabaseAdmin();
  const today = isoDate(now);
  const yesterday = isoDate(addDays(now, -1));
  const weekAgo = isoDate(addDays(now, -7));

  const { data: todayLogs } = await supabase
    .from("bloom_daily_logs")
    .select("*")
    .eq("log_date", today);
  const { data: yesterdayLogs } = await supabase
    .from("bloom_daily_logs")
    .select("*")
    .eq("log_date", yesterday);

  const done = (todayLogs ?? []).reduce(
    (acc, log) =>
      acc +
      ((log.completed_items as PlannedItem[] | null)?.length ??
        (log.planned_items as PlannedItem[] | null)?.filter((p) => p.done_bool).length ??
        0),
    0,
  );

  const highlights = (todayLogs ?? [])
    .flatMap((l) => {
      const h = (l as DailyLog).highlights;
      return h ? [h] : [];
    })
    .slice(0, 5);

  const tomorrowItems = (yesterdayLogs ?? [])
    .flatMap((l) =>
      ((l as DailyLog).next_steps ?? []).map((s) => s.title),
    )
    .slice(0, 5);

  // 全体進捗 = phase + module エントリの progress_pct 平均
  const overallPct = await fetchOverallProgress();

  // 先週比 = 今週の overallPct - 先週末時点の平均（bloom_project_progress スナップ）
  const { data: snaps } = await supabase
    .from("bloom_project_progress")
    .select("progress_pct")
    .lte("snapshot_on", weekAgo)
    .order("snapshot_on", { ascending: false })
    .limit(30);
  const prev = snaps && snaps.length > 0
    ? snaps.reduce((a, b) => a + (b.progress_pct ?? 0), 0) / snaps.length
    : overallPct;
  const diffPctWeek = overallPct - prev;

  return { doneCountToday: done, highlights, tomorrowItems, overallPct, diffPctWeek };
}

async function fetchOverallProgress(): Promise<number> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("bloom_roadmap_entries")
    .select("kind, progress_pct")
    .in("kind", ["phase", "module"])
    .eq("is_archived", false);
  const pcts = (data ?? [])
    .map((e) => e.progress_pct)
    .filter((v): v is number => typeof v === "number");
  if (pcts.length === 0) return 0;
  return Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
}

// ---- weekly 集計 --------------------------------------------------------

export type WeeklyAggregate = {
  weekLabel: string;
  achievements: string[];
  monthlyGoalPct: number;
  alerts: string[];
};

export async function aggregateWeekly(now: Date): Promise<WeeklyAggregate> {
  const supabase = getSupabaseAdmin();
  const sinceISO = isoDate(addDays(now, -6));

  const { data: logs } = await supabase
    .from("bloom_daily_logs")
    .select("*")
    .gte("log_date", sinceISO);

  // 今週完了した planned_items の title を 10 件まで拾う
  const achievements: string[] = [];
  for (const log of (logs ?? []) as DailyLog[]) {
    for (const item of log.completed_items ?? []) {
      if (achievements.length >= 10) break;
      if (item.title) achievements.push(item.title);
    }
  }

  // アラート = banner_severity = warn/critical のエントリ
  const { data: banners } = await supabase
    .from("bloom_roadmap_entries")
    .select("label_dev, label_ops, banner_severity, description")
    .eq("kind", "banner")
    .in("banner_severity", ["warn", "critical"])
    .eq("is_archived", false);
  const alerts = (banners ?? []).map(
    (b) =>
      `[${b.banner_severity}] ${b.label_ops ?? b.label_dev}${b.description ? `: ${b.description}` : ""}`,
  );

  // 月次目標達成率: bloom_module_progress の平均
  const { data: mods } = await supabase
    .from("bloom_module_progress")
    .select("progress_pct");
  const mpcts = (mods ?? []).map((m) => m.progress_pct ?? 0);
  const monthlyGoalPct =
    mpcts.length === 0 ? 0 : Math.round(mpcts.reduce((a, b) => a + b, 0) / mpcts.length);

  const weekLabel = `${isoDate(addDays(now, -6))} 〜 ${isoDate(now)}`;

  return { weekLabel, achievements, monthlyGoalPct, alerts };
}

// ---- monthly 集計 -------------------------------------------------------

export type MonthlyTargets = {
  digest: MonthlyDigest | null;
  monthLabel: string;
  publicPdfUrl: string;
};

/**
 * 月次ダイジェスト配信対象を決定する。
 * - 対象月 = 当月（毎月 14 日配信時点）
 * - status='published' を優先、draft はフォールバックでお知らせ（警告付き）
 */
export async function resolveMonthlyTarget(
  now: Date,
  bloomPublicUrl: string,
): Promise<MonthlyTargets> {
  const supabase = getSupabaseAdmin();
  const monthStart = startOfMonth(now);
  const { data } = await supabase
    .from("bloom_monthly_digests")
    .select("*")
    .eq("digest_month", monthStart)
    .maybeSingle();

  const monthKey = monthStart.slice(0, 7);
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const publicPdfUrl = `${bloomPublicUrl}/monthly-digest/${monthKey}/export`;

  return {
    digest: (data as MonthlyDigest | null) ?? null,
    monthLabel,
    publicPdfUrl,
  };
}

export type DigestLookupResult = {
  digest: MonthlyDigest | null;
  isPublished: boolean;
  status: MonthlyDigestStatus | null;
};

/** 月次 Cron: 配信可能か（published 状態）を判定する便宜関数 */
export function isMonthlyDigestSendable(digest: MonthlyDigest | null): DigestLookupResult {
  if (!digest) return { digest: null, isPublished: false, status: null };
  return {
    digest,
    isPublished: digest.status === "published",
    status: digest.status,
  };
}

// ---- RoadmapEntry エクスポート型（他モジュールが import する用） ----------

export type { RoadmapEntry };
