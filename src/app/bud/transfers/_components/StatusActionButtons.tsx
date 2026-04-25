"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBudState } from "../../_state/BudStateContext";
import { transitionTransferStatus } from "../../_lib/transfer-mutations";
import type { BudTransfer } from "../../_constants/types";
import {
  notifyTransferApproved,
  notifyTransferRejected,
} from "../../_actions/chatwork-notify";
import { RejectModal } from "./RejectModal";

interface Props {
  transfer: BudTransfer;
  createdBy: string | null;
  onTransitioned: () => void;
}

export function StatusActionButtons({
  transfer,
  createdBy,
  onTransitioned,
}: Props) {
  const router = useRouter();
  const { sessionUser, hasGardenRoleAtLeast } = useBudState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selfApproveWarning, setSelfApproveWarning] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);

  if (!sessionUser) return null;

  const isApprover = hasGardenRoleAtLeast("manager");
  const isAdmin = hasGardenRoleAtLeast("admin");
  const isSuperAdmin = hasGardenRoleAtLeast("super_admin");
  const isOwnDraft = createdBy === sessionUser.user_id;

  const transition = async (
    toStatus: Parameters<typeof transitionTransferStatus>[0]["toStatus"],
    reason?: string,
    notifyChatwork: boolean = false,
  ) => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await transitionTransferStatus({
        transferId: transfer.transfer_id,
        toStatus,
        reason,
      });
      if (!result.success) {
        setError(`${result.code}: ${result.error}`);
        return;
      }

      // Chatwork 通知（best-effort、失敗してもメイン処理は止めない）
      if (toStatus === "承認済み") {
        void notifyTransferApproved({
          transferId: transfer.transfer_id,
          payeeName: transfer.payee_name,
          amount: transfer.amount,
          fromStatus: transfer.status,
          toStatus,
          actorName: sessionUser?.name ?? null,
        }).catch(() => {});
      }
      if (toStatus === "差戻し" && notifyChatwork) {
        void notifyTransferRejected({
          transferId: transfer.transfer_id,
          payeeName: transfer.payee_name,
          amount: transfer.amount,
          fromStatus: transfer.status,
          toStatus,
          reason: reason ?? null,
          actorName: sessionUser?.name ?? null,
        }).catch(() => {});
      }

      onTransitioned();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = () => {
    if (isOwnDraft && !selfApproveWarning) {
      setSelfApproveWarning(true);
      return;
    }
    setSelfApproveWarning(false);
    void transition("承認済み");
  };

  const buttons: React.ReactNode[] = [];

  if (transfer.status === "下書き") {
    if (isSuperAdmin && isOwnDraft) {
      buttons.push(
        <button
          key="self-approve"
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "処理中…" : "即承認（super_admin 自起票スキップ）"}
        </button>,
      );
    }
    if (!isSuperAdmin || !isOwnDraft) {
      buttons.push(
        <button
          key="confirm"
          type="button"
          onClick={() => void transition("確認済み")}
          disabled={submitting}
          className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          確認済みにする
        </button>,
      );
    }
  }

  if (transfer.status === "確認済み") {
    buttons.push(
      <button
        key="request-approval"
        type="button"
        onClick={() => void transition("承認待ち")}
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        承認依頼
      </button>,
      <button
        key="to-draft"
        type="button"
        onClick={() => void transition("下書き")}
        disabled={submitting}
        className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100"
      >
        下書きに戻す
      </button>,
    );
  }

  if (transfer.status === "承認待ち" && isApprover) {
    buttons.push(
      <button
        key="approve"
        type="button"
        onClick={handleApprove}
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
      >
        ✓ 承認
      </button>,
      <button
        key="reject"
        type="button"
        onClick={() => setRejectOpen(true)}
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        ✗ 差戻し
      </button>,
    );
  }

  if (transfer.status === "承認済み" && isAdmin) {
    buttons.push(
      <button
        key="csv-export"
        type="button"
        onClick={() =>
          router.push(
            `/bud/transfers/csv-export?ids=${transfer.transfer_id}`,
          )
        }
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        📄 CSV 出力へ
      </button>,
    );
  }

  if (transfer.status === "CSV出力済み" && isAdmin) {
    buttons.push(
      <button
        key="mark-completed"
        type="button"
        onClick={() => void transition("振込完了")}
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
      >
        ✅ 振込完了マーク
      </button>,
    );
  }

  if (transfer.status === "差戻し" && isOwnDraft) {
    buttons.push(
      <button
        key="back-to-draft"
        type="button"
        onClick={() => void transition("下書き")}
        disabled={submitting}
        className="px-3 py-1.5 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
      >
        下書きに戻して修正
      </button>,
    );
  }

  if (buttons.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        このステータスに対して実行可能なアクションはありません
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {selfApproveWarning && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded p-3"
        >
          ⚠️ 起票者本人による承認です（Phase A では警告のみ）。もう一度
          「承認」または「即承認」を押すと確定します。
        </div>
      )}
      <div className="flex gap-2 flex-wrap">{buttons}</div>
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-800 text-sm rounded p-2"
        >
          {error}
        </div>
      )}
      <RejectModal
        open={rejectOpen}
        transferIds={[transfer.transfer_id]}
        onCancel={() => setRejectOpen(false)}
        submitting={submitting}
        onConfirm={async (reason, notifyChatwork) => {
          setRejectOpen(false);
          await transition("差戻し", reason, notifyChatwork);
        }}
      />
    </div>
  );
}
