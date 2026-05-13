/**
 * 仕訳一覧テーブル
 */

import type { BudJournalAccount, BudJournalEntry } from "../_lib/types";
import { SOURCE_LABELS, STATUS_BADGE_COLORS, STATUS_LABELS } from "../_lib/types";

interface Props {
  entries: BudJournalEntry[];
  accounts: BudJournalAccount[];
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

function accountLabel(
  accounts: BudJournalAccount[],
  code: string,
): string {
  const acc = accounts.find((a) => a.accountCode === code);
  return acc ? `${acc.accountCode} ${acc.accountName}` : code;
}

export function JournalTable({ entries, accounts }: Props) {
  return (
    <div className="bg-white rounded-lg shadow overflow-x-auto border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              日付
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              借方
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              貸方
            </th>
            <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
              金額
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              摘要
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              ソース
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
              状態
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map((e) => (
            <tr
              key={e.id}
              className={e.status === "cancelled" ? "opacity-50" : ""}
            >
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                {e.entryDate}
              </td>
              <td className="px-3 py-2 text-gray-800">
                {accountLabel(accounts, e.debitAccountCode)}
              </td>
              <td className="px-3 py-2 text-gray-800">
                {accountLabel(accounts, e.creditAccountCode)}
              </td>
              <td className="px-3 py-2 text-right font-mono text-gray-900 whitespace-nowrap">
                {formatYen(e.amount)}
              </td>
              <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                {e.description ?? "—"}
              </td>
              <td className="px-3 py-2 text-xs text-gray-500">
                {SOURCE_LABELS[e.source]}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs rounded ${STATUS_BADGE_COLORS[e.status]}`}
                >
                  {STATUS_LABELS[e.status]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
