/**
 * 仕訳帳サマリバー（件数 + status 別 + 借方/貸方合計）
 */

import type { JournalSummary } from "../_lib/types";

interface Props {
  summary: JournalSummary;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function JournalSummaryBar({ summary }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4 border border-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-500">仕訳件数</div>
          <div className="text-xl font-bold text-gray-800">
            {summary.totalEntries}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">借方合計</div>
          <div className="text-base font-mono font-semibold text-gray-800">
            {formatYen(summary.totalDebit)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">貸方合計</div>
          <div className="text-base font-mono font-semibold text-gray-800">
            {formatYen(summary.totalCredit)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">確認待ち</div>
          <div className="text-xl font-bold text-amber-600">
            {summary.byStatus.pending}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">弥生連携済</div>
          <div className="text-xl font-bold text-green-600">
            {summary.byStatus.exported}
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        期間: {summary.dateFrom} 〜 {summary.dateTo}
      </div>
    </div>
  );
}
