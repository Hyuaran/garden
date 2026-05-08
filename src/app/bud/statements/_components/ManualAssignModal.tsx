"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../_lib/supabase";
import { fetchMatchableTransfers } from "../../_lib/statement-queries";
import { transitionTransferStatus } from "../../_lib/transfer-mutations";
import type { MatchableTransfer } from "../../_lib/statement-matcher";
import type { BudStatementRow } from "../../_lib/statement-queries";

interface Props {
  open: boolean;
  statement: BudStatementRow | null;
  onClose: () => void;
  onAssigned: () => void;
}

export function ManualAssignModal({
  open,
  statement,
  onClose,
  onAssigned,
}: Props) {
  const [candidates, setCandidates] = useState<MatchableTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !statement) return;
    setSelectedTransferId("");
    setError(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchMatchableTransfers();
        if (!cancelled) {
          // 同金額（絶対値）優先で並べる
          const targetAmount = Math.abs(statement.amount);
          const sorted = [...data].sort((a, b) => {
            const aDiff = Math.abs(a.amount - targetAmount);
            const bDiff = Math.abs(b.amount - targetAmount);
            return aDiff - bDiff;
          });
          setCandidates(sorted);
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
  }, [open, statement?.id, statement?.amount]);

  if (!open || !statement) return null;

  const handleAssign = async () => {
    setError(null);
    if (!selectedTransferId) {
      setError("照合先の振込を選択してください");
      return;
    }
    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from("bud_statements")
        .update({
          matched_transfer_id: selectedTransferId,
          match_confidence: "manual",
          matched_at: new Date().toISOString(),
        })
        .eq("id", statement.id);

      if (updateErr) {
        setError(`明細更新に失敗: ${updateErr.message}`);
        return;
      }

      // 振込を 振込完了 に遷移
      const transitionRes = await transitionTransferStatus({
        transferId: selectedTransferId,
        toStatus: "振込完了",
      });
      if (!transitionRes.success) {
        setError(
          `照合済みにしましたが、振込ステータス遷移に失敗: ${transitionRes.error}`,
        );
        // それでも onAssigned して画面リロード
        onAssigned();
        return;
      }
      onAssigned();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">手動照合</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-500 hover:text-gray-700"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded p-3 text-sm">
            <div className="text-xs text-gray-500">明細</div>
            <div className="text-gray-900">
              {statement.transaction_date} / {statement.description} / ¥
              {Math.abs(statement.amount).toLocaleString()}（
              {statement.amount < 0 ? "出金" : "入金"}）
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              照合先候補（金額が近い順）
            </h3>
            {loading ? (
              <div className="text-sm text-gray-500">読み込み中…</div>
            ) : candidates.length === 0 ? (
              <div className="text-sm text-gray-500">
                承認済み・未実行の振込がありません
              </div>
            ) : (
              <div className="border rounded max-h-64 overflow-y-auto">
                {candidates.map((c) => (
                  <label
                    key={c.transfer_id}
                    className="flex items-center gap-2 p-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="radio"
                      name="transfer"
                      value={c.transfer_id}
                      checked={selectedTransferId === c.transfer_id}
                      onChange={() => setSelectedTransferId(c.transfer_id)}
                      className="accent-emerald-600"
                    />
                    <div className="flex-1 text-sm">
                      <div className="font-mono text-xs text-gray-700">
                        {c.transfer_id}
                      </div>
                      <div className="text-gray-900">
                        {c.payee_name} / ¥{c.amount.toLocaleString()} /{" "}
                        {c.scheduled_date ?? "—"} / {c.status}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2"
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleAssign}
            disabled={submitting || !selectedTransferId}
            className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "照合中…" : "この振込に照合"}
          </button>
        </div>
      </div>
    </div>
  );
}
