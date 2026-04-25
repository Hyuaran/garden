/**
 * Bloom 日次 Cron: Garden 日次進捗を Chatwork 「Garden 経費可視化」へ通知
 *
 * 実行: Vercel Cron 経由 / Authorization: Bearer <CRON_SECRET>
 * 時刻: vercel.json の schedule に従う（scaffold §4.4 では 0 9 * * * UTC = 18:00 JST）
 *
 * 仕様:
 *   - BLOOM_CHATWORK_DRY_RUN=true のときは実送信せずログのみ記録（Phase 1）
 *   - 送信前に bloom_cron_log へ pending で INSERT、完了後に success/failure で UPDATE
 */

import { renderDaily } from "../../../../../lib/chatwork/templates/daily";
import { aggregateDaily, isoDate } from "../_lib/aggregator";
import { runCron } from "../_lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runCron({
    kind: "daily",
    request,
    build: async ({ now, secrets }) => {
      const agg = await aggregateDaily(now);
      const body = renderDaily({
        date: isoDate(now),
        doneCount: agg.doneCountToday,
        highlights: agg.highlights,
        tomorrow: agg.tomorrowItems,
        overallPct: agg.overallPct,
        diffPct: agg.diffPctWeek,
        bloomUrl: secrets.bloomPublicUrl,
      });
      return { body };
    },
  });
}
