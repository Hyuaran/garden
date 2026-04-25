/**
 * Garden Root — KoT 日次勤怠 Cron Route（Phase A-3-c / A-3-d）
 *
 * スケジュール想定: `0 18 * * *`（UTC 18:00 = JST 03:00）
 *   - 前日（JST）分の `/daily-workings` を取込
 *   - A-3-c で 501 スタブ配備、A-3-d で `runDailySyncFull` 実装に差替
 *
 * 認証: `Authorization: Bearer ${CRON_SECRET}`
 *
 * 前提:
 *   - KoT API IP 制限（Issue #30）が Fixie で解消されるまで、Vercel 本番
 *     環境では KoT fetch が 403 になる。失敗ケースは `root_kot_sync_log`
 *     に failure 行として記録されるので可観測性は保たれる。
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import {
  runDailySyncFull,
  runOrphanedRunningCleanup,
} from "@/app/root/_lib/kot-sync-server";

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

  // Step 1: orphaned running cleanup（30 分超の stale running を failure 化）
  const cleanup = await runOrphanedRunningCleanup(30);

  // Step 2: 前日分の /daily-workings 取込
  const result = await runDailySyncFull(targetDate, "cron");

  return NextResponse.json(
    {
      ok: result.ok,
      target_date: result.target_date,
      log_id: result.log_id,
      records_fetched: result.records_fetched,
      records_inserted: result.records_inserted,
      records_skipped: result.records_skipped,
      upsert_errors: result.upsert_errors,
      error_code: result.error_code ?? null,
      error_message: result.error_message ?? null,
      cleanup,
    },
    { status: result.ok ? 200 : 500 },
  );
}
