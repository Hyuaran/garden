/**
 * 全社合計カード（最上段）
 */

import type { AllCorpsSummary } from "../_lib/types";

interface Props {
  summary: AllCorpsSummary;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function GrandTotalCard({ summary }: Props) {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-semibold opacity-90">
            6 法人 × 4 銀行 総合計
          </h2>
          <p className="text-xs opacity-75 mt-1">
            残高基準日: {summary.latestBalanceDate}
          </p>
        </div>
        <div className="text-3xl md:text-4xl font-mono font-bold">
          {formatYen(summary.grandTotal)}
        </div>
      </div>
    </div>
  );
}
