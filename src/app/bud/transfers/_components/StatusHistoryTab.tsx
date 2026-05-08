"use client";

import { useEffect, useState } from "react";
import {
  fetchStatusHistory,
  type BudTransferStatusHistoryRow,
} from "../../_lib/transfer-queries";
import { StatusBadge } from "./StatusBadge";
import type { TransferStatus } from "../../_constants/types";

interface Props {
  transferId: string;
}

export function StatusHistoryTab({ transferId }: Props) {
  const [rows, setRows] = useState<BudTransferStatusHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchStatusHistory(transferId);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transferId]);

  if (loading) {
    return <div className="text-sm text-gray-500 py-4">履歴を読み込み中…</div>;
  }

  if (error) {
    return (
      <div
        role="alert"
        className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-3"
      >
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        ステータス履歴はまだありません（東海林さん未適用の場合は SQL
        migration 適用後に表示されます）
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs">
          <tr>
            <th className="px-3 py-2 text-left">変更日時</th>
            <th className="px-3 py-2 text-left">遷移</th>
            <th className="px-3 py-2 text-left">実行者ロール</th>
            <th className="px-3 py-2 text-left">理由・備考</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-gray-900">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-xs text-gray-600">
                {new Date(r.changed_at).toLocaleString("ja-JP")}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {r.from_status ? (
                    <StatusBadge status={r.from_status as TransferStatus} size="sm" />
                  ) : (
                    <span className="text-xs text-gray-400">（新規）</span>
                  )}
                  <span className="text-gray-400">→</span>
                  <StatusBadge status={r.to_status as TransferStatus} size="sm" />
                </div>
              </td>
              <td className="px-3 py-2 text-xs text-gray-700">
                {r.changed_by_role}
              </td>
              <td className="px-3 py-2 text-xs text-gray-700">
                {r.reason ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
