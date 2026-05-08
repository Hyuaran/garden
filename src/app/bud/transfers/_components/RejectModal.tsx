"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  transferIds: string[];
  onConfirm: (reason: string, notifyChatwork: boolean) => void;
  onCancel: () => void;
  submitting?: boolean;
}

const REASON_MIN = 10;
const REASON_MAX = 500;

export function RejectModal({
  open,
  transferIds,
  onConfirm,
  onCancel,
  submitting,
}: Props) {
  const [reason, setReason] = useState("");
  const [notifyChatwork, setNotifyChatwork] = useState(false);

  if (!open) return null;

  const trimmedLen = reason.trim().length;
  const canConfirm = trimmedLen >= REASON_MIN && trimmedLen <= REASON_MAX;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-medium text-gray-900">差戻し確認</h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-gray-500 hover:text-gray-700"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-700">
            以下 {transferIds.length} 件を差戻しします：
          </p>
          <ul className="bg-gray-50 rounded p-2 text-sm text-gray-800 max-h-32 overflow-y-auto space-y-0.5">
            {transferIds.map((id) => (
              <li key={id} className="font-mono text-xs">
                • {id}
              </li>
            ))}
          </ul>

          <label className="block">
            <span className="text-sm text-gray-700">
              差戻し理由（{REASON_MIN} 文字以上）
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              rows={4}
              maxLength={REASON_MAX}
              className="mt-1 block w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              placeholder="例: 金額が請求書と異なるため、再確認をお願いします"
            />
            <div className="flex justify-between mt-1 text-xs">
              <span className={trimmedLen < REASON_MIN ? "text-red-600" : "text-gray-500"}>
                {trimmedLen < REASON_MIN
                  ? `あと ${REASON_MIN - trimmedLen} 文字以上必要です`
                  : "OK"}
              </span>
              <span className="text-gray-500">
                {reason.length} / {REASON_MAX}
              </span>
            </div>
          </label>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={notifyChatwork}
              onChange={(e) => setNotifyChatwork(e.target.checked)}
              disabled={submitting}
              className="accent-emerald-600"
            />
            <span className="text-gray-900">
              Chatwork で起票者に通知する
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t px-4 py-3 bg-gray-50">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim(), notifyChatwork)}
            disabled={!canConfirm || submitting}
            className="px-4 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "送信中…" : "差戻しを確定"}
          </button>
        </div>
      </div>
    </div>
  );
}
