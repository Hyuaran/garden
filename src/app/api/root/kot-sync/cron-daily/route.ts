/**
 * Garden Root — KoT 日次勤怠 Cron Route（Phase A-3-c）
 *
 * スケジュール想定: `0 18 * * *`（UTC / JST 03:00）
 *   - 前日分の /daily-workings を取込（実装は A-3-d）
 *   - 現時点（A-3-c）では実装未完のため 501 Not Implemented を返す
 *
 * 認証: `Authorization: Bearer ${CRON_SECRET}`
 *
 * A-3-d 完了後に `runDailySyncFull(targetDate)` を呼ぶ形に差し替える。
 * A-3-c の本 PR では Cron の配線・認証・orphaned cleanup までを提供する。
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runOrphanedRunningCleanup } from "@/app/root/_lib/kot-sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function previousDayJst(now: Date): string {
  // 「今日（JST）の前日」を YYYY-MM-DD で返す
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const jstYesterday = new Date(jstNow.getTime() - 24 * 60 * 60 * 1000);
  const y = jstYesterday.getUTCFullYear();
  const m = String(jstYesterday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jstYesterday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const now = new Date();
  const targetDate = previousDayJst(now);

  // orphaned cleanup だけは走らせる（running 残留解消）
  const cleanup = await runOrphanedRunningCleanup(30);

  // A-3-d 未実装のためスキップして 501 を返す
  return NextResponse.json(
    {
      ok: false,
      not_implemented: true,
      reason: "daily sync is pending A-3-d (/daily-workings 取込)",
      target_date: targetDate,
      cleanup,
    },
    { status: 501 },
  );
}
