/**
 * Bloom 月次 Cron: 月次ダイジェストを Chatwork へ事前共有
 *
 * 実行: 毎月 14 日 18:00 JST = 14 日 09:00 UTC（翌日が会議のためその前日）
 * 対象: 当月（now の月初）の bloom_monthly_digests.status='published'
 * ※ status が 'draft' のときはダイジェスト未完成の旨を警告付きで通知する
 *
 * PDF リンクは bloomPublicUrl + "/monthly-digest/<YYYY-MM>/export"（T9-7 で実装予定）。
 */

import { renderAlert } from "../../../../../lib/chatwork/templates/alert";
import { renderMonthly } from "../../../../../lib/chatwork/templates/monthly";
import { isMonthlyDigestSendable, resolveMonthlyTarget } from "../_lib/aggregator";
import { runCron } from "../_lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return runCron({
    kind: "monthly",
    request,
    build: async ({ now, secrets }) => {
      const target = await resolveMonthlyTarget(now, secrets.bloomPublicUrl);
      const lookup = isMonthlyDigestSendable(target.digest);

      if (lookup.isPublished) {
        const body = renderMonthly({
          month: target.monthLabel,
          pdfUrl: target.publicPdfUrl,
        });
        return { body };
      }

      // フォールバック: draft のままの場合は "まだ公開前" とアラート送信
      const subject = `${target.monthLabel} 月次ダイジェスト 未公開`;
      const detail =
        lookup.status === null
          ? "該当月のダイジェストがまだ作成されていません。"
          : "ダイジェストは下書き状態のままです。明日の会議までに公開してください。";
      const body = renderAlert({
        severity: "warn",
        subject,
        occurredAt: now.toISOString(),
        scope: "Garden Bloom 月次ダイジェスト",
        detail,
        url: `${secrets.bloomPublicUrl}/monthly-digest`,
      });
      return { body };
    },
  });
}
