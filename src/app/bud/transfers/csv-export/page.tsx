"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BudGate } from "../../_components/BudGate";
import { BudShell } from "../../_components/BudShell";
import { useBudState } from "../../_state/BudStateContext";
import {
  fetchTransferList,
} from "../../_lib/transfer-queries";
import type { BudTransfer } from "../../_constants/types";

interface BankGroup {
  bankName: string;
  count: number;
  totalAmount: number;
  transfers: BudTransfer[];
}

function groupByBank(transfers: BudTransfer[]): BankGroup[] {
  const map = new Map<string, BankGroup>();
  for (const t of transfers) {
    const key = t.payee_bank_name ?? "（銀行名未登録）";
    const existing = map.get(key) ?? {
      bankName: key,
      count: 0,
      totalAmount: 0,
      transfers: [],
    };
    existing.count += 1;
    existing.totalAmount += t.amount;
    existing.transfers.push(t);
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function CsvExportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { sessionUser, hasGardenRoleAtLeast } = useBudState();

  const [transfers, setTransfers] = useState<BudTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const preselected = searchParams?.get("ids")?.split(",").filter(Boolean) ?? [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { rows } = await fetchTransferList({
          statuses: ["承認済み"],
          limit: 500,
        });
        if (!cancelled) {
          setTransfers(rows);
          if (preselected.length > 0) {
            setSelectedIds(new Set(preselected));
          } else {
            setSelectedIds(new Set(rows.map((t) => t.transfer_id)));
          }
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preselected.join(",")]);

  const selectedTransfers = useMemo(
    () => transfers.filter((t) => selectedIds.has(t.transfer_id)),
    [transfers, selectedIds],
  );

  const groups = useMemo(
    () => groupByBank(selectedTransfers),
    [selectedTransfers],
  );

  const totalAmount = selectedTransfers.reduce((acc, t) => acc + t.amount, 0);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === transfers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transfers.map((t) => t.transfer_id)));
    }
  };

  if (!sessionUser) return null;
  if (!hasGardenRoleAtLeast("admin")) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-4"
        >
          CSV 出力は admin 以上のロールのみが実行できます。
        </div>
      </div>
    );
  }

  const handleExport = () => {
    alert(
      `CSV 出力は A-05 では骨格のみ実装されています。\n` +
        `選択: ${selectedTransfers.length} 件 / 合計 ¥${totalAmount.toLocaleString()}\n` +
        `詳細な全銀協 CSV 生成（Phase 1a のライブラリ呼出 + ZIP 同梱）は別タスクで実装予定です。`,
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <button
          type="button"
          onClick={() => router.push("/bud/transfers")}
          className="text-sm text-emerald-600 hover:underline"
        >
          ← 一覧に戻る
        </button>
      </div>
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        CSV 出力（全銀協フォーマット）
      </h1>

      {loading ? (
        <div className="text-center py-8 text-gray-500">読み込み中…</div>
      ) : error ? (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 rounded p-4"
        >
          {error}
        </div>
      ) : (
        <>
          <section className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              選択中の銀行別サマリ
            </h2>
            {groups.length === 0 ? (
              <p className="text-sm text-gray-500">対象が選択されていません</p>
            ) : (
              <ul className="text-sm space-y-1">
                {groups.map((g) => (
                  <li key={g.bankName} className="flex justify-between">
                    <span className="text-gray-700">
                      {g.bankName}: {g.count} 件
                    </span>
                    <span className="font-mono text-gray-900">
                      ¥{g.totalAmount.toLocaleString()}
                    </span>
                  </li>
                ))}
                <li className="flex justify-between border-t mt-2 pt-2 font-medium">
                  <span className="text-gray-800">合計</span>
                  <span className="font-mono text-gray-900">
                    {selectedTransfers.length} 件 / ¥{totalAmount.toLocaleString()}
                  </span>
                </li>
              </ul>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={
                        transfers.length > 0 &&
                        selectedIds.size === transfers.length
                      }
                      onChange={toggleAll}
                      disabled={transfers.length === 0}
                      className="accent-emerald-600"
                    />
                  </th>
                  <th className="px-3 py-2 text-left">振込ID</th>
                  <th className="px-3 py-2 text-left">お支払い先</th>
                  <th className="px-3 py-2 text-left">銀行</th>
                  <th className="px-3 py-2 text-right">金額</th>
                  <th className="px-3 py-2 text-left">予定日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {transfers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center text-gray-400"
                    >
                      出力対象（承認済み）がありません
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.transfer_id}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`選択 ${t.transfer_id}`}
                          checked={selectedIds.has(t.transfer_id)}
                          onChange={() => toggle(t.transfer_id)}
                          className="accent-emerald-600"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {t.transfer_id}
                      </td>
                      <td className="px-3 py-2">{t.payee_name}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.payee_bank_name ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        ¥{t.amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {t.scheduled_date ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => router.push("/bud/transfers")}
              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={selectedTransfers.length === 0}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              📄 CSV 出力（ZIP で DL）
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { groupByBank };

export default function CsvExportPage() {
  return (
    <BudGate>
      <BudShell>
        <CsvExportContent />
      </BudShell>
    </BudGate>
  );
}
