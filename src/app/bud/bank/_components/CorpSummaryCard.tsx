/**
 * 1 法人の銀行別残高サマリカード
 */

import type { CorpBankSummary } from "../_lib/types";

interface Props {
  summary: CorpBankSummary;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

export function CorpSummaryCard({ summary }: Props) {
  return (
    <div className="bg-white rounded-lg shadow p-5 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800">{summary.corpLabel}</h3>
        <span className="text-xl font-mono font-bold text-blue-700">
          {formatYen(summary.total)}
        </span>
      </div>

      <ul className="space-y-1.5">
        {summary.banks.map((b) => (
          <li
            key={b.bankCode}
            className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 last:border-0"
          >
            <div className="flex items-center gap-2">
              <span className="text-gray-700">{b.bankLabel}</span>
              {b.needsManualBalance && (
                <span
                  className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded"
                  title="通帳ベース手入力（CSV 取込不可）"
                >
                  手入力
                </span>
              )}
            </div>
            <span className="font-mono text-gray-900">
              {formatYen(b.balance)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 text-xs text-gray-500">
        最終更新: {summary.banks[0]?.balanceDate ?? "—"}
      </div>
    </div>
  );
}
