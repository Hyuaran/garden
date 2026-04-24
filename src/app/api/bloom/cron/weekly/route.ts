/**
 * Bloom 週次 Cron: Garden 週次サマリを Chatwork へ通知
 *
 * 実行: 金曜 18:00 JST = 金曜 09:00 UTC（vercel.json 参照）
 * BLOOM_CHATWORK_DRY_RUN / bloom_cron_log は daily と同仕様。
 */

import { renderWeekly } from "../../../../../lib/chatwork/templates/weekly";
import { aggregateWeekly } from "../_lib/aggregator";
import { runCron } from "../_lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runCron({
    kind: "weekly",
    request,
    build: async ({ now, secrets }) => {
      const agg = await aggregateWeekly(now);
      const body = renderWeekly({
        weekLabel: agg.weekLabel,
        achievements: agg.achievements,
        monthlyGoalPct: agg.monthlyGoalPct,
        alerts: agg.alerts,
        bloomUrl: secrets.bloomPublicUrl,
      });
      return { body };
    },
  });
}
