/**
 * Garden Root — KoT 月次勤怠 Cron Route（Phase A-3-c）
 *
 * スケジュール想定: `0 18 28-31 * *`（UTC / JST 03:00、月末候補日）
 *   - Route 側で「今日の翌日が月初か」を判定し、月末 1 回だけ実質処理を行う
 *   - それ以外の日は 202 Accepted で早期 return（ログ出しすぎない）
 *
 * 認証: `Authorization: Bearer ${CRON_SECRET}`
 *
 * 前提:
 *   - KoT API IP 制限問題（Issue #30）が Fixie で解消されるまで、
 *     Vercel 本番環境では KoT fetch が 403 で失敗する。
 *     その場合も root_kot_sync_log に failure 行として記録されるため、
 *     障害の可視性は保たれる。
 */

import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron-auth";
import {
  runMonthlySyncFull,
  runOrphanedRunningCleanup,
} from "@/app/root/_lib/kot-sync-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Pro: 5 分

function isLastDayOfMonthJst(now: Date): boolean {
  // JST の翌日を計算（JST = UTC+9）
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(jstNow.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.getUTCDate() === 1;
}

function currentMonthJst(now: Date): string {
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = jstNow.getUTCFullYear();
  const m = String(jstNow.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function GET(req: Request) {
  const auth = verifyCronRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }

  const now = new Date();

  // 月末判定（毎月 28-31 日スケジュールなので、実際に末日のときだけ実行）
  if (!isLastDayOfMonthJst(now)) {
    return NextResponse.json(
      {
        skipped: true,
        reason: "not last day of month (JST)",
        checked_at: now.toISOString(),
      },
      { status: 202 },
    );
  }

  // Step 1: orphaned running cleanup（A-3-b 一覧の stale 警告を解消）
  const cleanup = await runOrphanedRunningCleanup(30);

  // Step 2: 当月分を同期
  const targetMonth = currentMonthJst(now);
  const result = await runMonthlySyncFull(targetMonth, "cron");

  return NextResponse.json(
    {
      ok: result.ok,
      target_month: result.target_month,
      log_id: result.log_id,
      records_fetched: result.records_fetched,
      records_inserted: result.records_inserted,
      records_skipped: result.records_skipped,
      upsert_errors: result.upsert_errors,
      error_code: result.error_code ?? null,
      error_message: result.error_message ?? null,
      cleanup: cleanup,
    },
    { status: result.ok ? 200 : 500 },
  );
}
